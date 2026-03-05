import type { AdminAuthContext, EventAuthContext, SiteRow } from "./types"

declare global {
  namespace Express {
    interface Request {
      adminAuth?: AdminAuthContext
      site?: SiteRow
      siteOrigin?: string | null
      requestOrigin?: string | null
      clientIp?: string | null
      eventAuth?: EventAuthContext
    }
  }
}

export {}
