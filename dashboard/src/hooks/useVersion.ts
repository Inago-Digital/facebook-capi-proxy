import { useCallback, useEffect, useState } from "react"

import type { VersionInfo } from "../utils/types"
import type { ApiFetch } from "../context/AdminApiContext"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unexpected error"
}

export function useVersion(apiFetch: ApiFetch) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)

  const loadVersionInfo = useCallback(async () => {
    try {
      const data = await apiFetch<VersionInfo>("/version")
      setVersionInfo(data)
    } catch (err) {
      console.error("Failed to load version info:", getErrorMessage(err))
    }
  }, [apiFetch])

  useEffect(() => {
    loadVersionInfo()
  }, [loadVersionInfo])

  return {
    versionInfo,
  }
}
