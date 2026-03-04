interface ImportMetaEnvShape {
  VITE_ADMIN_API_BASE_URL?: string
}

declare global {
  interface Window {
    CAPI_ADMIN_API_BASE?: string
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "")
}

function readViteEnvBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: ImportMetaEnvShape }).env
  return normalizeBaseUrl(env?.VITE_ADMIN_API_BASE_URL || "")
}

export function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") return ""

  const queryParams = new URLSearchParams(window.location.search)
  const queryBase = normalizeBaseUrl(queryParams.get("server") || "")
  if (queryBase) return queryBase

  const globalBase = normalizeBaseUrl(window.CAPI_ADMIN_API_BASE || "")
  if (globalBase) return globalBase

  const metaBase = normalizeBaseUrl(
    document.querySelector('meta[name="api-base-url"]')?.getAttribute("content") ||
      "",
  )
  if (metaBase) return metaBase

  const viteBase = readViteEnvBaseUrl()
  if (viteBase) return viteBase

  return normalizeBaseUrl(window.location.origin)
}
