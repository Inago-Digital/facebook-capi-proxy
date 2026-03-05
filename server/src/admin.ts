"use strict"
/**
 * admin.ts - admin management routes.
 */

import express, { type Request, type Response } from "express"
const { v4: uuidv4 } = require("uuid") as { v4: () => string }

import db from "./db"
import {
  issueTokenPair,
  logoutWithRefreshToken,
  requireAccessToken,
  rotateRefreshToken,
  verifyAdminSecret,
} from "./admin-auth"
import type { SiteRow } from "./types"

const router = express.Router()

type AuthBody = {
  secret?: unknown
  refresh_token?: unknown
}

type CreateSiteBody = {
  name?: unknown
  domain?: unknown
  pixel_id?: unknown
  fb_token?: unknown
  note?: unknown
}

type UpdateSiteBody = {
  name?: unknown
  domain?: unknown
  pixel_id?: unknown
  fb_token?: unknown
  active?: unknown
  note?: unknown
}

type SiteStatsQuery = {
  limit?: string
}

function generateApiKey(): string {
  const hex = [...Array(40)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("")
  return `capi_${hex}`
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/$/, "")
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toDbActive(value: boolean): boolean | 0 | 1 {
  if (db.driver === "postgres") {
    return value
  }
  return value ? 1 : 0
}

type SiteWithMaskedToken = Omit<SiteRow, "fb_token"> & { fb_token: string | null }

function stripToken(site: SiteRow | undefined): SiteWithMaskedToken | undefined {
  if (!site) return undefined
  return {
    ...site,
    fb_token: site.fb_token ? `${site.fb_token.slice(0, 8)}...[hidden]` : null,
  }
}

function tokenPayload(tokens: Awaited<ReturnType<typeof issueTokenPair>>) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    access_expires_at: tokens.accessExpiresAt,
    refresh_expires_at: tokens.refreshExpiresAt,
  }
}

router.post(
  "/auth/login",
  async (req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> => {
    try {
      const secret = readRequiredString(req.body?.secret) ?? ""
      if (!verifyAdminSecret(secret)) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      const tokens = await issueTokenPair()
      return res.json(tokenPayload(tokens))
    } catch (err) {
      console.error("Admin login failed:", err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.post(
  "/auth/refresh",
  async (req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> => {
    try {
      const refreshToken = readRequiredString(req.body?.refresh_token) ?? ""

      if (!refreshToken) {
        return res.status(400).json({ error: "refresh_token is required" })
      }

      const tokens = await rotateRefreshToken(refreshToken)
      if (!tokens) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      return res.json(tokenPayload(tokens))
    } catch (err) {
      console.error("Token refresh failed:", err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.post(
  "/auth/logout",
  async (req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> => {
    try {
      const refreshToken = readRequiredString(req.body?.refresh_token) ?? ""

      if (!refreshToken) {
        return res.status(400).json({ error: "refresh_token is required" })
      }

      await logoutWithRefreshToken(refreshToken)
      return res.json({ ok: true })
    } catch (err) {
      console.error("Logout failed:", err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.get("/auth/me", requireAccessToken, (req: Request, res: Response): Response => {
  if (!req.adminAuth) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  return res.json({
    authenticated: true,
    access_expires_at: req.adminAuth.accessExpiresAt,
  })
})

router.use(requireAccessToken)

router.post(
  "/sites",
  async (req: Request<{}, {}, CreateSiteBody>, res: Response): Promise<Response> => {
    try {
      const name = readRequiredString(req.body?.name)
      const domain = readRequiredString(req.body?.domain)
      const pixelId = readRequiredString(req.body?.pixel_id)
      const fbToken = readRequiredString(req.body?.fb_token)
      const note = readOptionalString(req.body?.note)

      if (!name || !domain || !pixelId || !fbToken) {
        return res
          .status(400)
          .json({ error: "name, domain, pixel_id, fb_token are required" })
      }

      const id = uuidv4()
      const apiKey = generateApiKey()

      await db.run(
        `INSERT INTO sites (id, name, domain, api_key, pixel_id, fb_token, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, normalizeDomain(domain), apiKey, pixelId, fbToken, note],
      )

      return res
        .status(201)
        .json({ id, name, domain: normalizeDomain(domain), pixel_id: pixelId, api_key: apiKey, note })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.get("/sites", async (_req: Request, res: Response): Promise<Response> => {
  try {
    const sites = await db.all<SiteRow>(
      "SELECT * FROM sites ORDER BY created_at DESC",
      [],
    )
    return res.json(sites.map((site) => stripToken(site)))
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) })
  }
})

router.get(
  "/sites/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const site = await db.get<SiteRow>("SELECT * FROM sites WHERE id = ?", [
        req.params.id,
      ])
      if (!site) {
        return res.status(404).json({ error: "Not found" })
      }
      return res.json(stripToken(site))
    } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.patch(
  "/sites/:id",
  async (
    req: Request<{ id: string }, {}, UpdateSiteBody>,
    res: Response,
  ): Promise<Response> => {
    try {
      const updates: string[] = []
      const values: (string | number | boolean | null)[] = []

      const fields: ReadonlyArray<keyof UpdateSiteBody> = [
        "name",
        "domain",
        "pixel_id",
        "fb_token",
        "active",
        "note",
      ]

      for (const key of fields) {
        const raw = req.body?.[key]
        if (raw === undefined) {
          continue
        }

        if (key === "active") {
          if (typeof raw !== "boolean") {
            return res.status(400).json({ error: "active must be a boolean" })
          }
          updates.push("active = ?")
          values.push(toDbActive(raw))
          continue
        }

        if (key === "note") {
          if (raw !== null && typeof raw !== "string") {
            return res.status(400).json({ error: "note must be a string or null" })
          }

          const note = typeof raw === "string" ? raw.trim() || null : null
          updates.push("note = ?")
          values.push(note)
          continue
        }

        if (typeof raw !== "string") {
          return res.status(400).json({ error: `${key} must be a string` })
        }

        const value = raw.trim()
        if (!value) {
          return res.status(400).json({ error: `${key} must not be empty` })
        }

        updates.push(`${key} = ?`)
        values.push(key === "domain" ? normalizeDomain(value) : value)
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" })
      }

      values.push(req.params.id)
      const result = await db.run(
        `UPDATE sites SET ${updates.join(", ")} WHERE id = ?`,
        values,
      )

      if (result.changes === 0) {
        return res.status(404).json({ error: "Not found" })
      }
      return res.json({ updated: true })
    } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.delete(
  "/sites/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const result = await db.run("DELETE FROM sites WHERE id = ?", [
        req.params.id,
      ])
      if (result.changes === 0) {
        return res.status(404).json({ error: "Not found" })
      }
      return res.json({ deleted: true })
    } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.post(
  "/sites/:id/rotate",
  async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const newKey = generateApiKey()
      const result = await db.run("UPDATE sites SET api_key = ? WHERE id = ?", [
        newKey,
        req.params.id,
      ])
      if (result.changes === 0) {
        return res.status(404).json({ error: "Not found" })
      }
      return res.json({ api_key: newKey })
    } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

router.get(
  "/sites/:id/stats",
  async (
    req: Request<{ id: string }, {}, {}, SiteStatsQuery>,
    res: Response,
  ): Promise<Response> => {
    try {
      const requestedLimit = Number.parseInt(req.query.limit ?? "", 10)
      const limit = Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 500)

      const rows = await db.all(
        `SELECT * FROM event_log WHERE site_id = ? ORDER BY id DESC LIMIT ?`,
        [req.params.id, limit],
      )
      return res.json(rows)
    } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) })
    }
  },
)

export default router
