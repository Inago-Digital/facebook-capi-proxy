import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { stripProtocol } from "../utils/site"
import { resolveApiBaseUrl } from "../config/api-base"
import { useToast } from "./ToastContext"

const STORAGE_ACCESS_KEY = "fb_capi_admin_access_token"
const STORAGE_REFRESH_KEY = "fb_capi_admin_refresh_token"
const STORAGE_BASE_URL_KEY = "fb_capi_admin_base_url"
const STORAGE_BASE_URL_HISTORY_KEY = "fb_capi_admin_base_url_history"
const MAX_BASE_URL_HISTORY = 8
const REQUEST_TIMEOUT_MS = 8000

interface LoginResponse {
  access_token: string
  refresh_token: string
}

interface HealthResponse {
  ts: string
}

export interface ApiFetchMeta {
  skipAuth?: boolean
  allowRefresh?: boolean
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>
}

export type ApiFetch = <T>(
  path: string,
  options?: ApiFetchOptions,
  meta?: ApiFetchMeta,
) => Promise<T>

interface AdminApiContextValue {
  loading: boolean
  apiFetch: ApiFetch
  baseUrl: string
  serverUrlInput: string
  setServerUrlInput: (value: string) => void
  serverUrlHistory: string[]
  envLabel: string
  proxyUrl: string
  isConnected: boolean
  healthLabel: string
  healthColor: string
  healthTimestamp: string
  secretInput: string
  setSecretInput: (value: string) => void
  connect: (secretOverride?: string, baseUrlOverride?: string) => Promise<void>
  logout: () => Promise<void>
}

const AdminApiContext = createContext<AdminApiContextValue | null>(null)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Request timed out. Check the proxy URL and network connection"
  }

  if (error instanceof Error) return error.message
  return "Unexpected error"
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function isValidHttpUrl(value: string): boolean {
  if (!value) return false

  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function readStoredBaseUrlHistory(): string[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(STORAGE_BASE_URL_HISTORY_KEY) || "[]"
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const normalized = parsed
      .filter((item): item is string => typeof item === "string")
      .map(normalizeBaseUrl)
      .filter(Boolean)

    return [...new Set(normalized)]
  } catch {
    return []
  }
}

function writeStoredBaseUrlHistory(urls: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_BASE_URL_HISTORY_KEY, JSON.stringify(urls))
  } catch {
    // Storage access can fail in strict browser privacy modes.
  }
}

function mergeBaseUrlHistory(url: string, existing: string[]): string[] {
  const normalized = normalizeBaseUrl(url)
  if (!normalized) return existing

  return [normalized, ...existing.filter((value) => value !== normalized)].slice(
    0,
    MAX_BASE_URL_HISTORY,
  )
}

async function parseResponseJson<T>(
  response: Response,
): Promise<T & { error?: string }> {
  return response.json().catch(() => ({
    error: response.statusText || "Request failed",
  })) as Promise<T & { error?: string }>
}

export function AdminApiProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast()

  const [baseUrl, setBaseUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [healthTimestamp, setHealthTimestamp] = useState("-")
  const [secretInput, setSecretInput] = useState("")
  const [serverUrlInput, setServerUrlInputState] = useState("")
  const [serverUrlHistory, setServerUrlHistory] = useState<string[]>([])

  const baseUrlRef = useRef("")
  const accessTokenRef = useRef("")
  const refreshTokenRef = useRef("")
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null)

  const applyBaseUrl = useCallback((value: string) => {
    baseUrlRef.current = value
    setBaseUrl(value)
  }, [])

  const setStoredTokens = useCallback(
    (nextAccessToken: string, nextRefreshToken: string) => {
      accessTokenRef.current = nextAccessToken || ""
      refreshTokenRef.current = nextRefreshToken || ""

      try {
        localStorage.setItem(STORAGE_ACCESS_KEY, accessTokenRef.current)
        localStorage.setItem(STORAGE_REFRESH_KEY, refreshTokenRef.current)
      } catch {
        // Storage access can fail in strict browser privacy modes.
      }
    },
    [],
  )

  const clearStoredTokens = useCallback(() => {
    accessTokenRef.current = ""
    refreshTokenRef.current = ""
    refreshPromiseRef.current = null

    try {
      localStorage.removeItem(STORAGE_ACCESS_KEY)
      localStorage.removeItem(STORAGE_REFRESH_KEY)
    } catch {
      // Storage access can fail in strict browser privacy modes.
    }
  }, [])

  const setDisconnectedState = useCallback(() => {
    setIsConnected(false)
    setHealthTimestamp("-")
  }, [])

  const setServerUrlInput = useCallback((value: string) => {
    setServerUrlInputState(value)

    const normalized = normalizeBaseUrl(value)
    try {
      if (!normalized) {
        localStorage.removeItem(STORAGE_BASE_URL_KEY)
      } else if (isValidHttpUrl(normalized)) {
        localStorage.setItem(STORAGE_BASE_URL_KEY, normalized)
      }
    } catch {
      // Storage access can fail in strict browser privacy modes.
    }
  }, [])

  const setAndStoreBaseUrl = useCallback((value: string) => {
    const normalized = normalizeBaseUrl(value)
    if (!normalized || !isValidHttpUrl(normalized)) return

    setServerUrlInputState(normalized)
    setServerUrlHistory((current) => {
      const merged = mergeBaseUrlHistory(normalized, current)
      writeStoredBaseUrlHistory(merged)
      return merged
    })

    try {
      localStorage.setItem(STORAGE_BASE_URL_KEY, normalized)
    } catch {
      // Storage access can fail in strict browser privacy modes.
    }
  }, [])

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (!refreshTokenRef.current || !baseUrlRef.current) return false

    if (refreshPromiseRef.current) return refreshPromiseRef.current

    refreshPromiseRef.current = (async () => {
      const response = await fetchWithTimeout(
        baseUrlRef.current + "/admin/auth/refresh",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshTokenRef.current }),
        },
      )

      const payload = await parseResponseJson<LoginResponse>(response)
      if (!response.ok || !payload.access_token || !payload.refresh_token) {
        clearStoredTokens()
        return false
      }

      setStoredTokens(payload.access_token, payload.refresh_token)
      return true
    })()

    try {
      return await refreshPromiseRef.current
    } finally {
      refreshPromiseRef.current = null
    }
  }, [clearStoredTokens, setStoredTokens])

  const apiFetch = useCallback<ApiFetch>(
    async <T,>(
      path: string,
      options: ApiFetchOptions = {},
      meta: ApiFetchMeta = {},
    ): Promise<T> => {
      const { skipAuth = false, allowRefresh = true } = meta
      const currentBase = baseUrlRef.current
      if (!currentBase)
        throw new Error("Dashboard API base URL is not configured")

      const headers: Record<string, string> = { ...(options.headers || {}) }
      const hasBody = options.body !== undefined && options.body !== null

      if (hasBody && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json"
      }

      if (!skipAuth && accessTokenRef.current) {
        headers.Authorization = "Bearer " + accessTokenRef.current
      }

      let response = await fetchWithTimeout(currentBase + path, {
        ...options,
        headers,
      })

      if (!skipAuth && response.status === 401 && allowRefresh) {
        const refreshed = await refreshAccessToken()

        if (refreshed) {
          const retryHeaders: Record<string, string> = {
            ...headers,
            Authorization: "Bearer " + accessTokenRef.current,
          }

          response = await fetchWithTimeout(currentBase + path, {
            ...options,
            headers: retryHeaders,
          })
        }
      }

      const payload = await parseResponseJson<T>(response)
      if (!response.ok) {
        throw new Error(payload.error || response.statusText)
      }

      return payload
    },
    [refreshAccessToken],
  )

  const setConnectedState = useCallback(async () => {
    setIsConnected(true)

    try {
      const health = await apiFetch<HealthResponse>(
        "/health",
        {},
        { allowRefresh: false },
      )
      setHealthTimestamp(new Date(health.ts).toLocaleTimeString())
    } catch {
      setHealthTimestamp("unknown")
    }
  }, [apiFetch])

  const connect = useCallback(
    async (secretOverride?: string, baseUrlOverride?: string) => {
      const enteredSecret = (secretOverride ?? secretInput).trim()
      if (!enteredSecret) {
        addToast("Admin secret is required", "error")
        return
      }

      const enteredBase = normalizeBaseUrl(baseUrlOverride || serverUrlInput)
      if (enteredBase && !isValidHttpUrl(enteredBase)) {
        addToast("Proxy URL must be a valid http(s) URL", "error")
        return
      }

      const fallbackBase = normalizeBaseUrl(resolveApiBaseUrl())
      const resolvedBase = enteredBase || fallbackBase
      if (!resolvedBase || !isValidHttpUrl(resolvedBase)) {
        addToast("Unable to resolve API base URL", "error")
        return
      }

      applyBaseUrl(resolvedBase)
      setAndStoreBaseUrl(resolvedBase)

      try {
        const auth = await apiFetch<LoginResponse>(
          "/admin/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ secret: enteredSecret }),
          },
          { skipAuth: true, allowRefresh: false },
        )

        setStoredTokens(auth.access_token, auth.refresh_token)
        setSecretInput("")

        await setConnectedState()
        addToast("Connected to " + resolvedBase, "success")
      } catch (error) {
        clearStoredTokens()
        setDisconnectedState()
        addToast("Connection failed: " + getErrorMessage(error), "error")
      }
    },
    [
      addToast,
      apiFetch,
      applyBaseUrl,
      clearStoredTokens,
      secretInput,
      serverUrlInput,
      setConnectedState,
      setDisconnectedState,
      setAndStoreBaseUrl,
      setStoredTokens,
    ],
  )

  const logout = useCallback(async () => {
    try {
      if (refreshTokenRef.current) {
        await apiFetch(
          "/admin/auth/logout",
          {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshTokenRef.current }),
          },
          { skipAuth: true, allowRefresh: false },
        )
      }
    } catch (error) {
      addToast("Logout request failed: " + getErrorMessage(error), "error")
    } finally {
      clearStoredTokens()
      setSecretInput("")
      setDisconnectedState()
      addToast("Logged out", "info")
    }
  }, [addToast, apiFetch, clearStoredTokens, setDisconnectedState])

  useEffect(() => {
    if (typeof window === "undefined") return

    const initialize = async () => {
      let storedBaseUrl = ""
      try {
        storedBaseUrl = normalizeBaseUrl(
          localStorage.getItem(STORAGE_BASE_URL_KEY) || "",
        )
      } catch {
        storedBaseUrl = ""
      }
      const resolvedStoredBase = isValidHttpUrl(storedBaseUrl)
        ? storedBaseUrl
        : ""
      const fallbackBase = normalizeBaseUrl(resolveApiBaseUrl())
      const resolvedBase = resolvedStoredBase || fallbackBase

      if (resolvedBase && isValidHttpUrl(resolvedBase)) {
        applyBaseUrl(resolvedBase)
        setServerUrlInput(resolvedBase)
      }
      setServerUrlHistory(readStoredBaseUrlHistory())
      setDisconnectedState()

      let storedAccessToken = ""
      let storedRefreshToken = ""
      try {
        storedAccessToken = localStorage.getItem(STORAGE_ACCESS_KEY) || ""
        storedRefreshToken = localStorage.getItem(STORAGE_REFRESH_KEY) || ""
      } catch {
        storedAccessToken = ""
        storedRefreshToken = ""
      }

      const params = new URLSearchParams(window.location.search)
      const secretFromUrl = params.get("secret")

      if (secretFromUrl) {
        setSecretInput(secretFromUrl)
        await connect(secretFromUrl, resolvedBase)

        params.delete("secret")
        const nextUrl =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "") +
          window.location.hash
        window.history.replaceState({}, document.title, nextUrl)

        return
      }

      if (!storedAccessToken || !storedRefreshToken) return

      setStoredTokens(storedAccessToken, storedRefreshToken)

      try {
        await apiFetch("/admin/auth/me")
        await setConnectedState()
      } catch {
        clearStoredTokens()
        setDisconnectedState()
      }
    }

    void initialize()
      .catch((error) => {
        console.error("Failed to initialize admin API context:", error)
        clearStoredTokens()
        setDisconnectedState()
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const value = useMemo<AdminApiContextValue>(
    () => ({
      loading,
      apiFetch,
      baseUrl,
      serverUrlInput,
      setServerUrlInput,
      serverUrlHistory,
      envLabel:
        isConnected && baseUrl ? stripProtocol(baseUrl) : "not connected",
      proxyUrl: isConnected && baseUrl ? `${baseUrl}/event` : "-",
      isConnected,
      healthLabel: isConnected ? "● online" : "● offline",
      healthColor: isConnected ? "text-success" : "text-danger",
      healthTimestamp,
      secretInput,
      setSecretInput,
      connect,
      logout,
    }),
    [
      apiFetch,
      baseUrl,
      connect,
      healthTimestamp,
      isConnected,
      logout,
      serverUrlHistory,
      serverUrlInput,
      secretInput,
    ],
  )

  return (
    <AdminApiContext.Provider value={value}>
      {children}
    </AdminApiContext.Provider>
  )
}

export function useAdminApi() {
  const context = useContext(AdminApiContext)
  if (!context) {
    throw new Error("useAdminApi must be used within an AdminApiProvider")
  }

  return context
}
