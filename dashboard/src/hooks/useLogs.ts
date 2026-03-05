import { useCallback, useState } from "react"

import type { SiteLog } from "../utils/types"
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
  const [totalLogsCount, setTotalLogsCount] = useState<number | null>(null)
  const [logRows, setLogRows] = useState<SiteLog[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [logsLoadError, setLogsLoadError] = useState(false)

  const loadLogs = useCallback(
    async (
      siteIdOverride?: string,
      limitOverride?: number,
      cursor?: number,
      append = false,
    ) => {
      const targetSiteId = siteIdOverride ?? logsSiteId
      const targetLimit = limitOverride ?? logsLimit

      if (!targetSiteId) {
        addToast("Select a site first", "error")
        return
      }

      setIsLogsLoading(true)
      setLogsLoadError(false)

      try {
        const res = await apiFetch<{ rows: SiteLog[]; totalCount: number }>(
          `/admin/sites/${targetSiteId}/stats?limit=${targetLimit}${cursor ? `&cursor=${cursor}` : ""}`,
        )
        setLogRows((prevRows) =>
          append ? [...prevRows, ...res.rows] : res.rows,
        )
        setTotalLogsCount(res.totalCount)
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

  const loadMoreLogs = useCallback(() => {
    if (logRows.length === 0) return

    const lastLog = logRows[logRows.length - 1]
    const lastId = lastLog.id

    loadLogs(logsSiteId, logsLimit, lastId, true)
  }, [loadLogs, logRows, logsLimit, logsSiteId])

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
    loadMoreLogs,
    totalLogsCount,
  }
}
