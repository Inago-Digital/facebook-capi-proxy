/**
 * fb-capi-client.js
 * Drop this into any static site. Configure CAPI_PROXY and CAPI_KEY.
 * Optional: set CAPI_AUTH_URL (defaults to CAPI_PROXY + /auth).
 */

type CustomData = Record<string, unknown>

type UserDataInput = {
  em?: string
  email?: string
  ph?: string
  phone?: string
  fn?: string
  ln?: string
}

type FbCapiOptions = {
  event_source_url?: string
  test_event_code?: string
}

type FbCapiFn = (
  eventName: string,
  customData?: CustomData,
  userData?: UserDataInput,
  opts?: FbCapiOptions,
) => Promise<unknown>

interface Window {
  CAPI_AUTH_URL?: string
  CAPI_PROXY?: string
  CAPI_KEY?: string
  fbCapi: FbCapiFn
}

interface AuthResponseBody {
  access_token?: string
  expires_at?: string
  error?: string
}

interface EventResponseBody {
  error?: string
}

interface FbUserDataPayload extends Record<string, unknown> {
  external_id: string[]
  client_user_agent: string
  em?: string[]
  ph?: string[]
  fn?: string[]
  ln?: string[]
  fbc?: string
  fbp?: string
}

;(function (window: Window) {
  "use strict"

  let accessToken = ""
  let accessTokenExpiresAtMs = 0
  let pendingTokenPromise: Promise<string> | null = null
  const TOKEN_SKEW_MS = 5000

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
  }

  function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined
  }

  function resolveAuthUrl(): string {
    const explicit =
      typeof window.CAPI_AUTH_URL === "string" ? window.CAPI_AUTH_URL.trim() : ""
    if (explicit) return explicit

    const proxy = String(window.CAPI_PROXY || "").trim()
    if (!proxy) throw new Error("CAPI_PROXY must be set")

    if (/\/event\/?$/i.test(proxy)) {
      return proxy.replace(/\/event\/?$/i, "/event/auth")
    }

    return proxy.replace(/\/+$/, "") + "/auth"
  }

  function getProxyUrl(): string {
    const proxy = String(window.CAPI_PROXY || "").trim()
    if (!proxy) throw new Error("CAPI_PROXY must be set")
    return proxy
  }

  function getApiKey(): string {
    const key = String(window.CAPI_KEY || "").trim()
    if (!key) throw new Error("CAPI_KEY must be set")
    return key
  }

  async function sha256(str: string): Promise<string | undefined> {
    if (!str) return undefined
    const normalized = String(str).trim().toLowerCase()
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized),
    )

    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  function eventId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const random = crypto.getRandomValues(new Uint8Array(1))[0] & 15
      const value = ch === "x" ? random : (random & 3) | 8
      return value.toString(16)
    })
  }

  function getExternalId(): string {
    const key = "_fbcapi_eid"
    const match = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"))
    if (match) return match[1]

    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    document.cookie =
      key + "=" + id + "; max-age=31536000; path=/; SameSite=Lax"
    return id
  }

  async function fetchAccessToken(forceRefresh: boolean): Promise<string> {
    if (
      !forceRefresh &&
      accessToken &&
      Date.now() + TOKEN_SKEW_MS < accessTokenExpiresAtMs
    ) {
      return accessToken
    }

    if (!forceRefresh && pendingTokenPromise) {
      return pendingTokenPromise
    }

    pendingTokenPromise = (async function () {
      const res = await fetch(resolveAuthUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": getApiKey(),
        },
        body: JSON.stringify({ event_source_url: window.location.href }),
      })

      const bodyRaw = await res.json().catch(() => ({}))
      const body: AuthResponseBody = isRecord(bodyRaw) ? bodyRaw : {}

      const tokenValue = asString(body.access_token) ?? ""
      if (!res.ok || !tokenValue) {
        const message = asString(body.error) ?? "Failed to get event access token"
        throw new Error(message)
      }

      const expiresMs = Date.parse(asString(body.expires_at) ?? "")
      accessToken = tokenValue
      accessTokenExpiresAtMs = Number.isFinite(expiresMs)
        ? expiresMs
        : Date.now() + 60 * 1000

      return accessToken
    })()

    try {
      return await pendingTokenPromise
    } finally {
      pendingTokenPromise = null
    }
  }

  async function sendEventRequest(
    payload: Record<string, unknown>,
    token: string,
  ): Promise<Response> {
    return fetch(getProxyUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": getApiKey(),
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(payload),
    })
  }

  window.fbCapi = async function (
    eventName: string,
    customData: CustomData = {},
    userData: UserDataInput = {},
    opts: FbCapiOptions = {},
  ): Promise<unknown> {
    const ud: FbUserDataPayload = {
      external_id: [getExternalId()],
      client_user_agent: navigator.userAgent,
    }

    const email = userData.em || userData.email
    if (email) {
      const hashed = await sha256(email)
      if (hashed) ud.em = [hashed]
    }

    const phone = userData.ph || userData.phone
    if (phone) {
      const hashed = await sha256(phone)
      if (hashed) ud.ph = [hashed]
    }

    if (userData.fn) {
      const hashed = await sha256(userData.fn)
      if (hashed) ud.fn = [hashed]
    }

    if (userData.ln) {
      const hashed = await sha256(userData.ln)
      if (hashed) ud.ln = [hashed]
    }

    const fbcMatch = document.cookie.match(/(?:^|; )_fbc=([^;]*)/)
    const fbpMatch = document.cookie.match(/(?:^|; )_fbp=([^;]*)/)
    if (fbcMatch) ud.fbc = fbcMatch[1]
    if (fbpMatch) ud.fbp = fbpMatch[1]

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId(),
          event_source_url: opts.event_source_url || window.location.href,
          action_source: "website",
          user_data: ud,
          custom_data: customData,
        },
      ],
    }

    if (opts.test_event_code) payload.test_event_code = opts.test_event_code

    try {
      let token = await fetchAccessToken(false)
      let res = await sendEventRequest(payload, token)

      if (res.status === 401) {
        token = await fetchAccessToken(true)
        res = await sendEventRequest(payload, token)
      }

      const bodyRaw = await res.json().catch(() => ({}))
      const body: EventResponseBody = isRecord(bodyRaw) ? bodyRaw : {}

      if (!res.ok) {
        const err = asString(body.error) ?? "Event request failed"
        throw new Error(err)
      }

      return bodyRaw
    } catch (err) {
      console.warn("[fbCapi] Failed:", err)
      throw err
    }
  }

  window.fbCapi("PageView").catch(() => {
    // suppress unhandled rejection on load
  })
})(window)
