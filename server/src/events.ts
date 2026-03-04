"use strict"
/**
 * events.js - public endpoint for static-site event forwarding.
 *
 * Routes:
 *   POST /event/auth   -> issues short-lived event access token
 *   POST /event        -> forwards event payload to Facebook CAPI
 */

const crypto = require("crypto")
const express = require("express")
const fetch = require("node-fetch")
const db = require("./db")

const router = express.Router()

const FB_CAPI_URL =
  process.env.FB_CAPI_URL || "https://graph.facebook.com/v19.0"
const EVENT_ACCESS_TTL_SECONDS = getPositiveIntEnv(
  "EVENT_ACCESS_TTL_SECONDS",
  300,
)
const EVENT_DEDUP_TTL_HOURS = getPositiveIntEnv("EVENT_DEDUP_TTL_HOURS", 48)
const EVENT_SITE_RATE_LIMIT_MAX = getPositiveIntEnv(
  "EVENT_SITE_RATE_LIMIT_MAX",
  120,
)
const EVENT_SITE_RATE_LIMIT_WINDOW_MS = getPositiveIntEnv(
  "EVENT_SITE_RATE_LIMIT_WINDOW_MS",
  15 * 60 * 1000,
)
const EVENT_REQUIRE_ORIGIN = getBooleanEnv("EVENT_REQUIRE_ORIGIN", true)
const EVENT_REQUIRE_EVENT_SOURCE_URL = getBooleanEnv(
  "EVENT_REQUIRE_EVENT_SOURCE_URL",
  true,
)
const EVENT_TOKEN_BIND_IP = getBooleanEnv("EVENT_TOKEN_BIND_IP", false)

const SITE_ORIGIN_CACHE_TTL_MS = 15 * 1000
const CLEANUP_INTERVAL_MS = 60 * 1000

let siteOriginCache = {
  expiresAt: 0,
  origins: new Set(),
}

let lastCleanupAt = 0
const siteIpRateBuckets = new Map()

function getPositiveIntEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getBooleanEnv(name, fallback) {
  const value = process.env[name]
  if (typeof value !== "string") return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return fallback
}

function normalizeOrigin(input) {
  if (typeof input !== "string" || input.trim().length === 0) return null
  try {
    return new URL(input.trim()).origin.toLowerCase()
  } catch {
    return null
  }
}

function getSiteOrigin(siteDomain) {
  return normalizeOrigin(siteDomain)
}

function getRequestOrigin(req) {
  const origin = normalizeOrigin(req.headers.origin)
  if (origin) return origin
  return normalizeOrigin(req.headers.referer)
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim()
  }
  return req.ip
}

function getBearerToken(req) {
  const auth =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : ""
  if (!auth.startsWith("Bearer ")) return ""
  return auth.slice(7).trim()
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex")
}

function toIsoDate(input) {
  if (input instanceof Date) return input.toISOString()
  if (typeof input !== "string") return null
  const ms = Date.parse(input)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function isExpired(iso) {
  const ms = Date.parse(iso)
  return !Number.isFinite(ms) || ms <= Date.now()
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string")
    return value === "1" || value.toLowerCase() === "true"
  return false
}

async function getSiteByApiKey(apiKey) {
  return db.get("SELECT * FROM sites WHERE api_key = ? AND active = ?", [
    apiKey,
    db.driver === "postgres" ? true : 1,
  ])
}

async function getAllowedSiteOrigins() {
  if (Date.now() < siteOriginCache.expiresAt) {
    return siteOriginCache.origins
  }

  const rows = await db.all("SELECT domain FROM sites WHERE active = ?", [
    db.driver === "postgres" ? true : 1,
  ])

  const origins = new Set()
  for (const row of rows) {
    const siteOrigin = getSiteOrigin(row.domain)
    if (siteOrigin) origins.add(siteOrigin)
  }

  siteOriginCache = {
    expiresAt: Date.now() + SITE_ORIGIN_CACHE_TTL_MS,
    origins,
  }

  return origins
}

function validateSiteOrigin(site, requestOrigin) {
  const expectedOrigin = getSiteOrigin(site.domain)
  if (!expectedOrigin) {
    return { ok: false, status: 500, error: "Site domain is invalid" }
  }

  if (!requestOrigin) {
    if (EVENT_REQUIRE_ORIGIN) {
      return {
        ok: false,
        status: 403,
        error: "Origin or Referer header is required",
      }
    }
    return { ok: true, expectedOrigin }
  }

  if (requestOrigin !== expectedOrigin) {
    return { ok: false, status: 403, error: "Origin mismatch" }
  }

  return { ok: true, expectedOrigin }
}

function validateEventSourceUrls(events, expectedOrigin) {
  for (const event of events) {
    const sourceUrl =
      typeof event?.event_source_url === "string"
        ? event.event_source_url.trim()
        : ""

    if (!sourceUrl) {
      if (EVENT_REQUIRE_EVENT_SOURCE_URL) {
        return {
          ok: false,
          status: 400,
          error: "event_source_url is required for each event",
        }
      }
      continue
    }

    const sourceOrigin = normalizeOrigin(sourceUrl)
    if (!sourceOrigin) {
      return {
        ok: false,
        status: 400,
        error: "event_source_url must be a valid URL",
      }
    }

    if (sourceOrigin !== expectedOrigin) {
      return {
        ok: false,
        status: 403,
        error: "event_source_url origin mismatch",
      }
    }
  }

  return { ok: true }
}

function consumeSiteIpRateLimit(siteId, ip) {
  const now = Date.now()
  const key = `${siteId}:${ip || "unknown"}`
  const current = siteIpRateBuckets.get(key)

  if (!current || current.resetAt <= now) {
    siteIpRateBuckets.set(key, {
      count: 1,
      resetAt: now + EVENT_SITE_RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= EVENT_SITE_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

function cleanupRateBuckets() {
  const now = Date.now()
  for (const [key, value] of siteIpRateBuckets.entries()) {
    if (value.resetAt <= now) {
      siteIpRateBuckets.delete(key)
    }
  }
}

async function cleanupSecurityRows() {
  const nowIso = new Date().toISOString()
  const dedupCutoffIso = new Date(
    Date.now() - EVENT_DEDUP_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString()

  await db.run(
    `DELETE FROM event_tokens
     WHERE revoked_at IS NOT NULL OR expires_at <= ?`,
    [nowIso],
  )

  await db.run(
    `DELETE FROM event_dedup
     WHERE created_at <= ?`,
    [dedupCutoffIso],
  )
}

function scheduleCleanup() {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return
  }

  lastCleanupAt = now
  cleanupRateBuckets()
  Promise.resolve()
    .then(() => cleanupSecurityRows())
    .catch((err) => console.error("Security cleanup failed:", err))
}

async function issueEventAccessToken(siteId, origin, ip) {
  const token = crypto.randomBytes(32).toString("base64url")
  const expiresAt = new Date(
    Date.now() + EVENT_ACCESS_TTL_SECONDS * 1000,
  ).toISOString()

  await db.run(
    `INSERT INTO event_tokens (id, site_id, token_hash, origin, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      siteId,
      hashToken(token),
      origin,
      ip || null,
      expiresAt,
    ],
  )

  return {
    accessToken: token,
    expiresAt,
  }
}

async function getValidEventToken(rawToken) {
  if (!rawToken) return null

  const row = await db.get(
    `SELECT id, site_id, origin, ip, expires_at, revoked_at
     FROM event_tokens
     WHERE token_hash = ?`,
    [hashToken(rawToken)],
  )

  if (!row || row.revoked_at) {
    return null
  }

  const expiresAt = toIsoDate(row.expires_at)
  if (!expiresAt || isExpired(expiresAt)) {
    return null
  }

  return {
    id: row.id,
    siteId: row.site_id,
    origin: normalizeOrigin(row.origin),
    ip: row.ip,
    expiresAt,
  }
}

async function findDuplicateEventIds(siteId, eventIds) {
  const duplicates = []

  for (const eventId of eventIds) {
    const row = await db.get(
      `SELECT event_id
       FROM event_dedup
       WHERE site_id = ? AND event_id = ?`,
      [siteId, eventId],
    )

    if (row) duplicates.push(eventId)
  }

  return duplicates
}

async function storeEventIds(siteId, eventIds) {
  const sql =
    db.driver === "postgres"
      ? `INSERT INTO event_dedup (site_id, event_id)
       VALUES (?, ?)
       ON CONFLICT (site_id, event_id) DO NOTHING`
      : `INSERT OR IGNORE INTO event_dedup (site_id, event_id)
       VALUES (?, ?)`

  for (const eventId of eventIds) {
    await db.run(sql, [siteId, eventId])
  }
}

async function requireSite(req, res, next) {
  const apiKey =
    typeof req.headers["x-api-key"] === "string"
      ? req.headers["x-api-key"].trim()
      : ""
  if (!apiKey) {
    return res.status(401).json({ error: "Missing X-Api-Key header" })
  }

  try {
    const site = await getSiteByApiKey(apiKey)
    if (!site || !coerceBoolean(site.active)) {
      return res.status(403).json({ error: "Invalid or inactive API key" })
    }

    req.site = site
    req.siteOrigin = getSiteOrigin(site.domain)
    req.requestOrigin = getRequestOrigin(req)
    req.clientIp = getClientIp(req)
    return next()
  } catch (err) {
    console.error("Site lookup error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function requireEventAccessToken(req, res, next) {
  const token = getBearerToken(req)

  if (!token) {
    return res.status(401).json({ error: "Missing event access token" })
  }

  try {
    const record = await getValidEventToken(token)
    if (!record) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (record.siteId !== req.site.id) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.siteOrigin && record.origin && record.origin !== req.siteOrigin) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (
      req.requestOrigin &&
      record.origin &&
      req.requestOrigin !== record.origin
    ) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (EVENT_TOKEN_BIND_IP && record.ip && record.ip !== req.clientIp) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    req.eventAuth = record
    return next()
  } catch (err) {
    console.error("Token validation error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

// Dynamic CORS for static-site callers: only allow origins that belong to active sites.
router.use(async (req, res, next) => {
  const requestOrigin = getRequestOrigin(req)
  if (!requestOrigin) {
    if (req.method === "OPTIONS") {
      return res.status(204).end()
    }
    return next()
  }

  try {
    const allowedOrigins = await getAllowedSiteOrigins()
    if (allowedOrigins.has(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin)
      res.setHeader("Vary", "Origin")
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Api-Key, Authorization",
      )
      res.setHeader("Access-Control-Max-Age", "600")

      if (req.method === "OPTIONS") {
        return res.status(204).end()
      }

      return next()
    }

    if (req.method === "OPTIONS") {
      return res.status(403).json({ error: "Origin not allowed" })
    }

    return next()
  } catch (err) {
    console.error("Event CORS check failed:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// ── POST /event/auth ──────────────────────────────────────────────────────────
router.post("/auth", requireSite, async (req, res) => {
  scheduleCleanup()

  const originCheck = validateSiteOrigin(req.site, req.requestOrigin)
  if (!originCheck.ok) {
    return res.status(originCheck.status).json({ error: originCheck.error })
  }

  const sourceUrl =
    typeof req.body?.event_source_url === "string"
      ? req.body.event_source_url.trim()
      : ""
  if (sourceUrl) {
    const sourceOrigin = normalizeOrigin(sourceUrl)
    if (!sourceOrigin) {
      return res
        .status(400)
        .json({ error: "event_source_url must be a valid URL" })
    }
    if (sourceOrigin !== originCheck.expectedOrigin) {
      return res.status(403).json({ error: "event_source_url origin mismatch" })
    }
  }

  try {
    const issued = await issueEventAccessToken(
      req.site.id,
      originCheck.expectedOrigin,
      EVENT_TOKEN_BIND_IP ? req.clientIp : null,
    )

    return res.json({
      access_token: issued.accessToken,
      expires_at: issued.expiresAt,
      token_type: "Bearer",
    })
  } catch (err) {
    console.error("Event auth issuance failed:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// ── POST /event ───────────────────────────────────────────────────────────────
router.post("/", requireSite, requireEventAccessToken, async (req, res) => {
  scheduleCleanup()

  const originCheck = validateSiteOrigin(req.site, req.requestOrigin)
  if (!originCheck.ok) {
    return res.status(originCheck.status).json({ error: originCheck.error })
  }

  const body = req.body
  if (!body || !Array.isArray(body.data) || body.data.length === 0) {
    return res
      .status(400)
      .json({ error: '"data" array is required and must not be empty' })
  }

  const sourceCheck = validateEventSourceUrls(
    body.data,
    originCheck.expectedOrigin,
  )
  if (!sourceCheck.ok) {
    return res.status(sourceCheck.status).json({ error: sourceCheck.error })
  }

  const eventIds = []
  const payloadSeen = new Set()

  for (const event of body.data) {
    const eventId =
      typeof event?.event_id === "string" ? event.event_id.trim() : ""
    if (!eventId) {
      return res
        .status(400)
        .json({ error: "event_id is required for each event" })
    }
    if (payloadSeen.has(eventId)) {
      return res
        .status(409)
        .json({
          error: "Duplicate event_id in payload",
          duplicate_event_id: eventId,
        })
    }
    payloadSeen.add(eventId)
    eventIds.push(eventId)
  }

  const rate = consumeSiteIpRateLimit(req.site.id, req.clientIp)
  if (!rate.allowed) {
    return res
      .status(429)
      .set("Retry-After", String(rate.retryAfterSeconds))
      .json({ error: "Rate limit exceeded for this site/IP" })
  }

  let knownDuplicates = []
  try {
    knownDuplicates = await findDuplicateEventIds(req.site.id, eventIds)
  } catch (err) {
    console.error("Replay lookup failed:", err)
    return res.status(500).json({ error: "Internal server error" })
  }

  if (knownDuplicates.length > 0) {
    return res.status(409).json({
      error: "Duplicate event_id rejected",
      duplicate_event_ids: knownDuplicates.slice(0, 20),
    })
  }

  const enrichedData = body.data.map((event) => {
    const ud = event.user_data || {}
    return {
      ...event,
      user_data: {
        client_ip_address: ud.client_ip_address || req.clientIp,
        client_user_agent:
          ud.client_user_agent || req.headers["user-agent"] || "",
        ...ud,
      },
    }
  })

  const fbPayload = {
    data: enrichedData,
    ...(body.test_event_code ? { test_event_code: body.test_event_code } : {}),
  }

  const fbUrl = `${FB_CAPI_URL}/${req.site.pixel_id}/events?access_token=${req.site.fb_token}`

  let fbStatus = null
  let fbBody = null
  let logError = null

  try {
    const fbRes = await fetch(fbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
      timeout: 8000,
    })

    fbStatus = fbRes.status
    fbBody = await fbRes.json()

    // Mark event IDs as seen only after a completed forward call.
    await storeEventIds(req.site.id, eventIds)

    return res.status(fbStatus).json(fbBody)
  } catch (err) {
    logError = err.message
    console.error(`[${req.site.name}] FB CAPI request failed:`, err.message)
    return res
      .status(502)
      .json({ error: "Failed to reach Facebook CAPI", details: err.message })
  } finally {
    const eventName = body.data[0]?.event_name || null
    const received = fbBody?.events_received ?? null

    Promise.resolve()
      .then(() =>
        db.run(
          `INSERT INTO event_log (site_id, event_name, fb_status, fb_events_received, error, ip)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.site.id, eventName, fbStatus, received, logError, req.clientIp],
        ),
      )
      .catch((e) => console.error("Log write failed:", e))
  }
})

module.exports = router

export {}
