"use strict"

const crypto = require("crypto")

const db = require("./db")

const TOKEN_TYPE_ACCESS = "access"
const TOKEN_TYPE_REFRESH = "refresh"

const DEFAULT_ACCESS_TTL_MINUTES = 15
const DEFAULT_REFRESH_TTL_DAYS = 7

function hashForCompare(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest()
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex")
}

function verifyAdminSecret(candidate) {
  const configured = process.env.ADMIN_SECRET
  if (
    typeof configured !== "string" ||
    configured.length === 0 ||
    typeof candidate !== "string" ||
    candidate.length === 0
  ) {
    return false
  }

  const candidateHash = hashForCompare(candidate)
  const configuredHash = hashForCompare(configured)
  return crypto.timingSafeEqual(candidateHash, configuredHash)
}

function getPositiveIntEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

function getAccessTtlMs() {
  const minutes = getPositiveIntEnv(
    "ADMIN_ACCESS_TTL_MINUTES",
    DEFAULT_ACCESS_TTL_MINUTES,
  )
  return minutes * 60 * 1000
}

function getRefreshTtlMs() {
  const days = getPositiveIntEnv("ADMIN_REFRESH_TTL_DAYS", DEFAULT_REFRESH_TTL_DAYS)
  return days * 24 * 60 * 60 * 1000
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url")
}

function parseIsoDate(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value !== "string") {
    return null
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
}

function isExpired(isoDate) {
  const parsed = Date.parse(isoDate)
  return !Number.isFinite(parsed) || parsed <= Date.now()
}

function getBearerToken(req) {
  const auth = req.headers.authorization || ""
  if (!auth.startsWith("Bearer ")) {
    return ""
  }
  return auth.slice(7).trim()
}

async function cleanupTokenRows() {
  const nowIso = new Date().toISOString()
  await db.run(
    `DELETE FROM admin_tokens
     WHERE revoked_at IS NOT NULL OR expires_at <= ?`,
    [nowIso],
  )
}

async function insertTokenRow(sessionId, tokenType, ttlMs) {
  const token = generateToken()
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  await db.run(
    `INSERT INTO admin_tokens (id, session_id, token_hash, token_type, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, sessionId, hashToken(token), tokenType, expiresAt],
  )

  return {
    id,
    token,
    expiresAt,
  }
}

async function issueTokenPair(existingSessionId = null) {
  const sessionId = existingSessionId || crypto.randomUUID()

  const access = await insertTokenRow(sessionId, TOKEN_TYPE_ACCESS, getAccessTtlMs())
  const refresh = await insertTokenRow(
    sessionId,
    TOKEN_TYPE_REFRESH,
    getRefreshTtlMs(),
  )

  await cleanupTokenRows()

  return {
    sessionId,
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt,
    refreshExpiresAt: refresh.expiresAt,
  }
}

async function getValidTokenRecord(rawToken, tokenType) {
  if (!rawToken || typeof rawToken !== "string") {
    return null
  }

  const row = await db.get(
    `SELECT id, session_id, token_type, expires_at, revoked_at
     FROM admin_tokens
     WHERE token_hash = ? AND token_type = ?`,
    [hashToken(rawToken), tokenType],
  )

  if (!row || row.revoked_at) {
    return null
  }

  const expiresAt = parseIsoDate(row.expires_at)
  if (!expiresAt || isExpired(expiresAt)) {
    return null
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    tokenType: row.token_type,
    expiresAt,
  }
}

async function revokeTokenById(id) {
  await db.run(
    `UPDATE admin_tokens
     SET revoked_at = ?
     WHERE id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), id],
  )
}

async function revokeSessionTokens(sessionId) {
  await db.run(
    `UPDATE admin_tokens
     SET revoked_at = ?
     WHERE session_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), sessionId],
  )
}

async function rotateRefreshToken(rawRefreshToken) {
  const refresh = await getValidTokenRecord(rawRefreshToken, TOKEN_TYPE_REFRESH)
  if (!refresh) {
    return null
  }

  await revokeTokenById(refresh.id)
  await revokeSessionTokens(refresh.sessionId)

  return issueTokenPair(refresh.sessionId)
}

async function logoutWithRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
    return { ok: true }
  }

  const row = await db.get(
    `SELECT session_id
     FROM admin_tokens
     WHERE token_hash = ?`,
    [hashToken(rawRefreshToken)],
  )

  if (!row) {
    return { ok: true }
  }

  await revokeSessionTokens(row.session_id)
  await cleanupTokenRows()

  return { ok: true }
}

async function requireAccessToken(req, res, next) {
  try {
    const accessToken = getBearerToken(req)
    const access = await getValidTokenRecord(accessToken, TOKEN_TYPE_ACCESS)

    if (!access) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    req.adminAuth = {
      method: "token",
      sessionId: access.sessionId,
      accessExpiresAt: access.expiresAt,
      tokenId: access.id,
    }

    return next()
  } catch (err) {
    console.error("Access token middleware failed:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  issueTokenPair,
  logoutWithRefreshToken,
  requireAccessToken,
  rotateRefreshToken,
  verifyAdminSecret,
}

export {}
