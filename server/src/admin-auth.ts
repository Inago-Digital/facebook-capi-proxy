"use strict"

import crypto from "crypto"
import type { NextFunction, Request, Response } from "express"

import db from "./db"
import type { AdminTokenRow, IssuedTokenPair } from "./types"

const TOKEN_TYPE_ACCESS = "access" as const
const TOKEN_TYPE_REFRESH = "refresh" as const

type TokenType = typeof TOKEN_TYPE_ACCESS | typeof TOKEN_TYPE_REFRESH

const DEFAULT_ACCESS_TTL_MINUTES = 15
const DEFAULT_REFRESH_TTL_DAYS = 7

function hashForCompare(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest()
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex")
}

export function verifyAdminSecret(candidate: string): boolean {
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

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getAccessTtlMs(): number {
  const minutes = getPositiveIntEnv(
    "ADMIN_ACCESS_TTL_MINUTES",
    DEFAULT_ACCESS_TTL_MINUTES,
  )
  return minutes * 60 * 1000
}

function getRefreshTtlMs(): number {
  const days = getPositiveIntEnv("ADMIN_REFRESH_TTL_DAYS", DEFAULT_REFRESH_TTL_DAYS)
  return days * 24 * 60 * 60 * 1000
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

function parseIsoDate(value: unknown): string | null {
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

function isExpired(isoDate: string): boolean {
  const parsed = Date.parse(isoDate)
  return !Number.isFinite(parsed) || parsed <= Date.now()
}

function getBearerToken(req: Request): string {
  const raw = req.headers.authorization
  const auth = Array.isArray(raw) ? raw[0] ?? "" : raw ?? ""
  if (!auth.startsWith("Bearer ")) {
    return ""
  }
  return auth.slice(7).trim()
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function cleanupTokenRows(): Promise<void> {
  const nowIso = new Date().toISOString()
  await db.run(
    `DELETE FROM admin_tokens
     WHERE revoked_at IS NOT NULL OR expires_at <= ?`,
    [nowIso],
  )
}

async function insertTokenRow(
  sessionId: string,
  tokenType: TokenType,
  ttlMs: number,
): Promise<{ id: string; token: string; expiresAt: string }> {
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

export async function issueTokenPair(
  existingSessionId: string | null = null,
): Promise<IssuedTokenPair> {
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

type ValidTokenRecord = {
  id: string
  sessionId: string
  tokenType: TokenType
  expiresAt: string
}

async function getValidTokenRecord(
  rawToken: string,
  tokenType: TokenType,
): Promise<ValidTokenRecord | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null
  }

  const row = await db.get<
    Pick<AdminTokenRow, "id" | "session_id" | "token_type" | "expires_at" | "revoked_at">
  >(
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
    tokenType,
    expiresAt,
  }
}

async function revokeTokenById(id: string): Promise<void> {
  await db.run(
    `UPDATE admin_tokens
     SET revoked_at = ?
     WHERE id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), id],
  )
}

async function revokeSessionTokens(sessionId: string): Promise<void> {
  await db.run(
    `UPDATE admin_tokens
     SET revoked_at = ?
     WHERE session_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), sessionId],
  )
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
): Promise<IssuedTokenPair | null> {
  const refresh = await getValidTokenRecord(rawRefreshToken, TOKEN_TYPE_REFRESH)
  if (!refresh) {
    return null
  }

  await revokeTokenById(refresh.id)
  await revokeSessionTokens(refresh.sessionId)

  return issueTokenPair(refresh.sessionId)
}

export async function logoutWithRefreshToken(
  rawRefreshToken: string,
): Promise<{ ok: true }> {
  if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
    return { ok: true }
  }

  const row = await db.get<Pick<AdminTokenRow, "session_id">>(
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

export async function requireAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
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
    return res.status(500).json({ error: getErrorMessage(err) })
  }
}
