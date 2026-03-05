"use strict"
/**
 * events.ts - public endpoint for static-site event forwarding.
 */

import crypto from "crypto"
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express"

import db from "./db"
import type { EventAuthContext, EventForwardBody, EventPayloadItem, EventTokenRow, SiteRow } from "./types"

type FetchResponse = {
  status: number
  ok: boolean
  json: () => Promise<unknown>
}

type FetchInit = {
  method: "POST"
  headers: Record<string, string>
  body: string
  timeout: number
}

type FetchFn = (url: string, init: FetchInit) => Promise<FetchResponse>

const fetch = require("node-fetch") as FetchFn

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

let siteOriginCache: { expiresAt: number; origins: Set<string> } = {
  expiresAt: 0,
  origins: new Set<string>(),
}

let lastCleanupAt = 0
const siteIpRateBuckets = new Map<string, { count: number; resetAt: number }>()

type SiteScopedRequest = Request & {
  site: SiteRow
  siteOrigin: string | null
  requestOrigin: string | null
  clientIp: string | null
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (typeof value !== "string") return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return fallback
}

function normalizeOrigin(input: string | null | undefined): string | null {
  if (typeof input !== "string" || input.trim().length === 0) return null
  try {
    return new URL(input.trim()).origin.toLowerCase()
  } catch {
    return null
  }
}

function getSiteOrigin(siteDomain: string): string | null {
  return normalizeOrigin(siteDomain)
}

function getHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return typeof value === "string" ? value : ""
}

function getRequestOrigin(req: Request): string | null {
  const origin = normalizeOrigin(getHeaderValue(req.headers.origin))
  if (origin) return origin
  return normalizeOrigin(getHeaderValue(req.headers.referer))
}

function getClientIp(req: Request): string | null {
  const forwardedValue = getHeaderValue(req.headers["x-forwarded-for"])
  if (forwardedValue.trim()) {
    return forwardedValue.split(",")[0]?.trim() ?? null
  }

  return typeof req.ip === "string" && req.ip.trim() ? req.ip : null
}

function getBearerToken(req: Request): string {
  const auth = getHeaderValue(req.headers.authorization)
  if (!auth.startsWith("Bearer ")) return ""
  return auth.slice(7).trim()
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex")
}

function toIsoDate(input: unknown): string | null {
  if (input instanceof Date) return input.toISOString()
  if (typeof input !== "string") return null
  const ms = Date.parse(input)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function isExpired(iso: string): boolean {
  const ms = Date.parse(iso)
  return !Number.isFinite(ms) || ms <= Date.now()
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string")
    return value === "1" || value.toLowerCase() === "true"
  return false
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function requireSiteContext(
  req: Request,
  res: Response,
): SiteScopedRequest | null {
  if (
    !req.site ||
    req.siteOrigin === undefined ||
    req.requestOrigin === undefined ||
    req.clientIp === undefined
  ) {
    res.status(500).json({ error: "Request site context is missing" })
    return null
  }

  return req as SiteScopedRequest
}

function readEventSourceUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function getSiteByApiKey(apiKey: string): Promise<SiteRow | null> {
  const row = await db.get<SiteRow>(
    "SELECT * FROM sites WHERE api_key = ? AND active = ?",
    [apiKey, db.driver === "postgres" ? true : 1],
  )
  return row ?? null
}

async function getAllowedSiteOrigins(): Promise<Set<string>> {
  if (Date.now() < siteOriginCache.expiresAt) {
    return siteOriginCache.origins
  }

  const rows = await db.all<Pick<SiteRow, "domain">>(
    "SELECT domain FROM sites WHERE active = ?",
    [db.driver === "postgres" ? true : 1],
  )

  const origins = new Set<string>()
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

type OriginValidationResult =
  | { ok: true; expectedOrigin: string }
  | { ok: false; status: number; error: string }

function validateSiteOrigin(
  site: SiteRow,
  requestOrigin: string | null,
): OriginValidationResult {
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

type SourceUrlValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

function validateEventSourceUrls(
  events: EventPayloadItem[],
  expectedOrigin: string,
): SourceUrlValidationResult {
  for (const event of events) {
    const sourceUrl = readEventSourceUrl(event.event_source_url)

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

function consumeSiteIpRateLimit(
  siteId: string,
  ip: string | null,
): { allowed: true; retryAfterSeconds: 0 } | { allowed: false; retryAfterSeconds: number } {
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

function cleanupRateBuckets(): void {
  const now = Date.now()
  for (const [key, value] of siteIpRateBuckets.entries()) {
    if (value.resetAt <= now) {
      siteIpRateBuckets.delete(key)
    }
  }
}

async function cleanupSecurityRows(): Promise<void> {
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

function scheduleCleanup(): void {
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

async function issueEventAccessToken(
  siteId: string,
  origin: string | null,
  ip: string | null,
): Promise<{ accessToken: string; expiresAt: string }> {
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

async function getValidEventToken(rawToken: string): Promise<EventAuthContext | null> {
  if (!rawToken) return null

  const row = await db.get<
    Pick<EventTokenRow, "id" | "site_id" | "origin" | "ip" | "expires_at" | "revoked_at">
  >(
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

async function findDuplicateEventIds(
  siteId: string,
  eventIds: string[],
): Promise<string[]> {
  const duplicates: string[] = []

  for (const eventId of eventIds) {
    const row = await db.get<{ event_id: string }>(
      `SELECT event_id
       FROM event_dedup
       WHERE site_id = ? AND event_id = ?`,
      [siteId, eventId],
    )

    if (row) duplicates.push(eventId)
  }

  return duplicates
}

async function storeEventIds(siteId: string, eventIds: string[]): Promise<void> {
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

async function requireSite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  const apiKey = getHeaderValue(req.headers["x-api-key"]).trim()
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
    return res.status(500).json({ error: getErrorMessage(err) })
  }
}

async function requireEventAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  const token = getBearerToken(req)

  if (!token) {
    return res.status(401).json({ error: "Missing event access token" })
  }

  const ctx = requireSiteContext(req, res)
  if (!ctx) {
    return
  }

  try {
    const record = await getValidEventToken(token)
    if (!record) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (record.siteId !== ctx.site.id) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (ctx.siteOrigin && record.origin && record.origin !== ctx.siteOrigin) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (ctx.requestOrigin && record.origin && ctx.requestOrigin !== record.origin) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    if (EVENT_TOKEN_BIND_IP && record.ip && record.ip !== ctx.clientIp) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    req.eventAuth = record
    return next()
  } catch (err) {
    console.error("Token validation error:", err)
    return res.status(500).json({ error: getErrorMessage(err) })
  }
}

router.use(async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
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
    return res.status(500).json({ error: getErrorMessage(err) })
  }
})

type EventAuthBody = {
  event_source_url?: unknown
}

router.post(
  "/auth",
  requireSite,
  async (req: Request<{}, {}, EventAuthBody>, res: Response): Promise<Response | void> => {
    scheduleCleanup()

    const ctx = requireSiteContext(req, res)
    if (!ctx) {
      return
    }

    const originCheck = validateSiteOrigin(ctx.site, ctx.requestOrigin)
    if (!originCheck.ok) {
      return res.status(originCheck.status).json({ error: originCheck.error })
    }

    const sourceUrl = readEventSourceUrl(req.body?.event_source_url)
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
        ctx.site.id,
        originCheck.expectedOrigin,
        EVENT_TOKEN_BIND_IP ? ctx.clientIp : null,
      )

      return res.json({
        access_token: issued.accessToken,
        expires_at: issued.expiresAt,
        token_type: "Bearer",
      })
    } catch (err) {
      console.error("Event auth issuance failed:", err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

function getUserAgent(req: Request): string {
  const value = getHeaderValue(req.headers["user-agent"])
  return value || ""
}

function getEventsReceived(value: unknown): number | null {
  if (!isRecord(value)) {
    return null
  }

  const received = value.events_received
  return typeof received === "number" ? received : null
}

router.post(
  "/",
  requireSite,
  requireEventAccessToken,
  async (req: Request<{}, {}, EventForwardBody>, res: Response): Promise<Response | void> => {
    scheduleCleanup()

    const ctx = requireSiteContext(req, res)
    if (!ctx) {
      return
    }

    const originCheck = validateSiteOrigin(ctx.site, ctx.requestOrigin)
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

    const eventIds: string[] = []
    const payloadSeen = new Set<string>()

    for (const event of body.data) {
      const eventId = typeof event.event_id === "string" ? event.event_id.trim() : ""
      if (!eventId) {
        return res
          .status(400)
          .json({ error: "event_id is required for each event" })
      }
      if (payloadSeen.has(eventId)) {
        return res.status(409).json({
          error: "Duplicate event_id in payload",
          duplicate_event_id: eventId,
        })
      }
      payloadSeen.add(eventId)
      eventIds.push(eventId)
    }

    const rate = consumeSiteIpRateLimit(ctx.site.id, ctx.clientIp)
    if (!rate.allowed) {
      return res
        .status(429)
        .set("Retry-After", String(rate.retryAfterSeconds))
        .json({ error: "Rate limit exceeded for this site/IP" })
    }

    let knownDuplicates: string[] = []
    try {
      knownDuplicates = await findDuplicateEventIds(ctx.site.id, eventIds)
    } catch (err) {
      console.error("Replay lookup failed:", err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }

    if (knownDuplicates.length > 0) {
      return res.status(409).json({
        error: "Duplicate event_id rejected",
        duplicate_event_ids: knownDuplicates.slice(0, 20),
      })
    }

    const enrichedData = body.data.map((event) => {
      const userData = isRecord(event.user_data) ? event.user_data : {}

      return {
        ...event,
        user_data: {
          client_ip_address:
            typeof userData.client_ip_address === "string" && userData.client_ip_address
              ? userData.client_ip_address
              : ctx.clientIp,
          client_user_agent:
            typeof userData.client_user_agent === "string" && userData.client_user_agent
              ? userData.client_user_agent
              : getUserAgent(req),
          ...userData,
        },
      }
    })

    const testEventCode =
      typeof body.test_event_code === "string" && body.test_event_code.trim()
        ? body.test_event_code.trim()
        : undefined

    const fbPayload = {
      data: enrichedData,
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    }

    const fbUrl = `${FB_CAPI_URL}/${ctx.site.pixel_id}/events?access_token=${ctx.site.fb_token}`

    let fbStatus: number | null = null
    let fbBody: unknown = null
    let logError: string | null = null

    try {
      const fbRes = await fetch(fbUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbPayload),
        timeout: 8000,
      })

      fbStatus = fbRes.status
      fbBody = await fbRes.json()

      await storeEventIds(ctx.site.id, eventIds)

      return res.status(fbStatus).json(fbBody)
    } catch (err) {
      logError = getErrorMessage(err)
      console.error(`[${ctx.site.name}] FB CAPI request failed:`, logError)
      return res
        .status(502)
        .json({ error: "Failed to reach Facebook CAPI", details: logError })
    } finally {
      const firstEvent = body.data[0]
      const eventName =
        firstEvent && typeof firstEvent.event_name === "string"
          ? firstEvent.event_name
          : null
      const received = getEventsReceived(fbBody)

      Promise.resolve()
        .then(() =>
          db.run(
            `INSERT INTO event_log (site_id, event_name, fb_status, fb_events_received, error, ip)
           VALUES (?, ?, ?, ?, ?, ?)`,
            [
              ctx.site.id,
              eventName,
              fbStatus,
              received,
              logError,
              ctx.clientIp,
            ],
          ),
        )
        .catch((e) => console.error("Log write failed:", e))
    }
  },
)

export default router
