export type ViewName = "overview" | "sites" | "logs" | "snippet"

export type ToastType = "success" | "error" | "info"

export interface Site {
  id: string
  name: string
  domain: string
  pixel_id: string
  active: boolean | number
  api_key?: string | null
  note?: string | null
  created_at?: string | null
}

export interface SiteLog {
  id: number
  created_at?: string | null
  event_name?: string | null
  fb_status?: number | null
  fb_events_received?: number | null
  ip?: string | null
  error?: string | null
}

export interface SiteFormState {
  id: string
  name: string
  domain: string
  pixel: string
  token: string
  note: string
}

export interface ToastMessage {
  id: number
  type: ToastType
  message: string
}
