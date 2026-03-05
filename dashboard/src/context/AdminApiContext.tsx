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
  envLabel: string
  proxyUrl: string
  isConnected: boolean
  healthLabel: string
  healthColor: string
  healthTimestamp: string
  secretInput: string
  setSecretInput: (value: string) => void
  connect: (secretOverride?: string) => Promise<void>
  logout: () => Promise<void>
}

const AdminApiContext = createContext<AdminApiContextValue | null>(null)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unexpected error"
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

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (!refreshTokenRef.current || !baseUrlRef.current) return false

    if (refreshPromiseRef.current) return refreshPromiseRef.current

    refreshPromiseRef.current = (async () => {
      const response = await fetch(baseUrlRef.current + "/admin/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshTokenRef.current }),
      })

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

      let response = await fetch(currentBase + path, { ...options, headers })

      if (!skipAuth && response.status === 401 && allowRefresh) {
        const refreshed = await refreshAccessToken()

        if (refreshed) {
          const retryHeaders: Record<string, string> = {
            ...headers,
            Authorization: "Bearer " + accessTokenRef.current,
          }

          response = await fetch(currentBase + path, {
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
    async (secretOverride?: string) => {
      const enteredSecret = (secretOverride ?? secretInput).trim()
      if (!enteredSecret) {
        addToast("Admin secret is required", "error")
        return
      }

      const resolvedBase = resolveApiBaseUrl()
      if (!resolvedBase) {
        addToast("Unable to resolve API base URL", "error")
        return
      }

      applyBaseUrl(resolvedBase)

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
      setConnectedState,
      setDisconnectedState,
      setStoredTokens,
      setLoading,
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
      applyBaseUrl(resolveApiBaseUrl())
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
        await connect(secretFromUrl)

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
