export type IsoDateString = string

export interface SiteRow {
  id: string
  name: string
  domain: string
  api_key: string
  pixel_id: string
  fb_token: string
  active: boolean | number
  created_at: IsoDateString | Date
  note: string | null
}

export interface EventLogRow {
  id: number
  site_id: string
  event_name: string | null
  fb_status: number | null
  fb_events_received: number | null
  error: string | null
  ip: string | null
  created_at: IsoDateString | Date
}

export interface EventTokenRow {
  id: string
  site_id: string
  token_hash: string
  origin: string
  ip: string | null
  expires_at: IsoDateString | Date
  revoked_at: IsoDateString | Date | null
  created_at: IsoDateString | Date
}

export interface EventDedupRow {
  site_id: string
  event_id: string
  created_at: IsoDateString | Date
}

export interface AdminTokenRow {
  id: string
  session_id: string
  token_hash: string
  token_type: "access" | "refresh"
  expires_at: IsoDateString | Date
  revoked_at: IsoDateString | Date | null
  created_at: IsoDateString | Date
}

export interface IssuedTokenPair {
  sessionId: string
  accessToken: string
  refreshToken: string
  accessExpiresAt: IsoDateString
  refreshExpiresAt: IsoDateString
}

export interface AdminAuthContext {
  method: "token"
  sessionId: string
  accessExpiresAt: IsoDateString
  tokenId: string
}

export interface EventAuthContext {
  id: string
  siteId: string
  origin: string | null
  ip: string | null
  expiresAt: IsoDateString
}

export interface EventUserData extends Record<string, unknown> {
  client_ip_address?: string
  client_user_agent?: string
}

export interface EventPayloadItem extends Record<string, unknown> {
  event_id?: string
  event_name?: string
  event_source_url?: string
  user_data?: EventUserData
}

export interface EventForwardBody {
  data?: EventPayloadItem[]
  test_event_code?: string
}
