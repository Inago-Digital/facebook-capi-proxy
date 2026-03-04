/**
 * fb-capi-client.js
 * Drop this into any static site. Configure CAPI_PROXY and CAPI_KEY.
 * Optional: set CAPI_AUTH_URL (defaults to CAPI_PROXY + /auth).
 *
 * Usage (after script loads):
 *   fbCapi('Purchase', { value: 49.99, currency: 'USD' });
 *   fbCapi('Lead');
 *   fbCapi('PageView');  ← fired automatically on load
 */
;(function (window) {
  "use strict"

  var accessToken = ""
  var accessTokenExpiresAtMs = 0
  var pendingTokenPromise = null
  var TOKEN_SKEW_MS = 5000

  function resolveAuthUrl() {
    var explicit = typeof window.CAPI_AUTH_URL === "string" ? window.CAPI_AUTH_URL.trim() : ""
    if (explicit) return explicit

    var proxy = String(window.CAPI_PROXY || "").trim()
    if (!proxy) throw new Error("CAPI_PROXY must be set")

    if (/\/event\/?$/i.test(proxy)) {
      return proxy.replace(/\/event\/?$/i, "/event/auth")
    }

    return proxy.replace(/\/+$/, "") + "/auth"
  }

  function getProxyUrl() {
    var proxy = String(window.CAPI_PROXY || "").trim()
    if (!proxy) throw new Error("CAPI_PROXY must be set")
    return proxy
  }

  function getApiKey() {
    var key = String(window.CAPI_KEY || "").trim()
    if (!key) throw new Error("CAPI_KEY must be set")
    return key
  }

  async function sha256(str) {
    if (!str) return undefined
    var normalized = String(str).trim().toLowerCase()
    var buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized),
    )
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  function eventId() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
    )
  }

  function getExternalId() {
    var key = "_fbcapi_eid"
    var match = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"))
    if (match) return match[1]
    var id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    document.cookie =
      key + "=" + id + "; max-age=31536000; path=/; SameSite=Lax"
    return id
  }

  async function fetchAccessToken(forceRefresh) {
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
      var res = await fetch(resolveAuthUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": getApiKey(),
        },
        body: JSON.stringify({ event_source_url: window.location.href }),
      })

      var body = await res.json().catch(function () {
        return {}
      })

      if (!res.ok || !body.access_token) {
        var message = body && body.error ? body.error : "Failed to get event access token"
        throw new Error(message)
      }

      var expiresMs = Date.parse(body.expires_at)
      accessToken = body.access_token
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

  async function sendEventRequest(payload, token) {
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

  /**
   * @param {string}  eventName
   * @param {object}  customData  { value, currency, content_ids, … }
   * @param {object}  userData    { em, ph, fn, ln }  — hashed automatically
   * @param {object}  opts        { test_event_code }
   */
  window.fbCapi = async function (eventName, customData, userData, opts) {
    opts = opts || {}
    userData = userData || {}
    customData = customData || {}

    var ud = {
      external_id: [getExternalId()],
      client_user_agent: navigator.userAgent,
    }

    if (userData.em || userData.email)
      ud.em = [await sha256(userData.em || userData.email)]
    if (userData.ph || userData.phone)
      ud.ph = [await sha256(userData.ph || userData.phone)]
    if (userData.fn) ud.fn = [await sha256(userData.fn)]
    if (userData.ln) ud.ln = [await sha256(userData.ln)]

    var fbcMatch = document.cookie.match(/(?:^|; )_fbc=([^;]*)/)
    var fbpMatch = document.cookie.match(/(?:^|; )_fbp=([^;]*)/)
    if (fbcMatch) ud.fbc = fbcMatch[1]
    if (fbpMatch) ud.fbp = fbpMatch[1]

    var payload = {
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
      var token = await fetchAccessToken(false)
      var res = await sendEventRequest(payload, token)

      if (res.status === 401) {
        token = await fetchAccessToken(true)
        res = await sendEventRequest(payload, token)
      }

      var body = await res.json().catch(function () {
        return {}
      })

      if (!res.ok) {
        var err = body && body.error ? body.error : "Event request failed"
        throw new Error(err)
      }

      return body
    } catch (err) {
      console.warn("[fbCapi] Failed:", err)
      throw err
    }
  }

  // Auto PageView
  window.fbCapi("PageView").catch(function () {
    // suppress unhandled rejection on load
  })
})(window)
