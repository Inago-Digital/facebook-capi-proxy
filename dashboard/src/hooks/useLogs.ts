import { useCallback, useState } from "react"

import type { SiteLog } from "../components/types"
import type { ApiFetch } from "../context/AdminApiContext"
import { useToast } from "../context/ToastContext"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unexpected error"
}

export function useLogs(apiFetch: ApiFetch) {
  const { addToast } = useToast()

  const [logsSiteId, setLogsSiteId] = useState("")
  const [logsLimit, setLogsLimit] = useState(50)
  const [logRows, setLogRows] = useState<SiteLog[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [logsLoadError, setLogsLoadError] = useState(false)

  const loadLogs = useCallback(
    async (siteIdOverride?: string, limitOverride?: number) => {
      const targetSiteId = siteIdOverride ?? logsSiteId
      const targetLimit = limitOverride ?? logsLimit

      if (!targetSiteId) {
        addToast("Select a site first", "error")
        return
      }

      setIsLogsLoading(true)
      setLogsLoadError(false)

      try {
        const rows = await apiFetch<SiteLog[]>(
          `/admin/sites/${targetSiteId}/stats?limit=${targetLimit}`,
        )
        setLogRows(rows)
      } catch (error) {
        setLogRows([])
        setLogsLoadError(true)
        addToast("Failed to load logs: " + getErrorMessage(error), "error")
      } finally {
        setIsLogsLoading(false)
      }
    },
    [addToast, apiFetch, logsLimit, logsSiteId],
  )

  return {
    logsSiteId,
    setLogsSiteId,
    logsLimit,
    setLogsLimit,
    logRows,
    setLogRows,
    isLogsLoading,
    logsLoadError,
    setLogsLoadError,
    loadLogs,
  }
}
