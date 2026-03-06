import { cn } from "../../utils/cn"
import { formatDate } from "../../utils/site"
import type { Site, SiteLog } from "../../utils/types"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Card, CardHeader, CardTitle } from "../ui/Card"
import { OverflowTooltip } from "../ui/OverflowTooltip"
import { PageHeader } from "../ui/PageHeader"
import { Select } from "../ui/Select"
import { Spinner } from "../ui/Spinner"
import {
  DataTable,
  EmptyTableCell,
  TableCell,
  TableHeadCell,
  TableRow,
} from "../ui/Table"

interface LogsViewProps {
  visible: boolean
  isConnected: boolean
  sites: Site[]
  selectedSiteId: string
  limit: number
  isLoading: boolean
  hasError: boolean
  rows: SiteLog[]
  totalLogsCount: number | null
  onSelectedSiteChange: (siteId: string) => void
  onLimitChange: (limit: number) => void
  onLoad: () => void
  onLoadMore: () => void
}

const limitOptions = [
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
]

export function LogsView({
  visible,
  isConnected,
  sites,
  selectedSiteId,
  limit,
  isLoading,
  hasError,
  rows,
  totalLogsCount,
  onSelectedSiteChange,
  onLimitChange,
  onLoad,
  onLoadMore,
}: LogsViewProps) {
  const emptyMessage = !isConnected
    ? "Connect to load logs"
    : !selectedSiteId
      ? "Choose a site and click Load"
      : hasError
        ? "Error loading logs"
        : "No events logged yet"

  return (
    <section
      className={cn("hidden flex-col gap-6", visible && "flex")}
      id="view-logs"
    >
      <PageHeader
        title="Event Logs"
        subtitle="Recent CAPI forwarding activity per site"
      />

      <Card>
        <CardHeader>
          <CardTitle>Select site</CardTitle>
        </CardHeader>

        <div className="flex items-center gap-2.5 px-5 py-4">
          <Select
            options={sites.map((site) => ({
              label: site.name,
              description: site.domain,
              value: site.id,
            }))}
            value={selectedSiteId}
            onChange={(value) => onSelectedSiteChange(value as string)}
            placeholder="Select a site"
            className="max-w-96"
          />

          <Select
            className="w-20"
            value={String(limit)}
            options={limitOptions}
            onChange={(value) =>
              onLimitChange(Number.parseInt(value as string, 10))
            }
          />

          <Button variant="ghost" size="sm" onClick={onLoad}>
            Load
          </Button>
        </div>

        <DataTable>
          <thead>
            <tr>
              <TableHeadCell>Time</TableHeadCell>
              <TableHeadCell>Event</TableHeadCell>
              <TableHeadCell>FB Status</TableHeadCell>
              <TableHeadCell>Received</TableHeadCell>
              <TableHeadCell>IP</TableHeadCell>
              <TableHeadCell>Error</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-5 text-center">
                  <Spinner size="sm" className="mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <EmptyTableCell colSpan={6}>{emptyMessage}</EmptyTableCell>
              </tr>
            ) : (
              rows.map((row, index) => {
                const status = row.fb_status
                const ok = !!status && status < 300

                return (
                  <TableRow
                    key={`${row.created_at || "no-ts"}-${index}`}
                    className={cn(
                      ok && "text-success",
                      !ok && row.error && "text-danger",
                    )}
                  >
                    <TableCell className="text-textDim">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>{row.event_name || "-"}</TableCell>
                    <TableCell>
                      <Badge tone={ok ? "green" : "red"}>{status || "-"}</Badge>
                    </TableCell>
                    <TableCell>{row.fb_events_received ?? "-"}</TableCell>
                    <TableCell className="text-textDim">
                      {row.ip || "-"}
                    </TableCell>
                    <TableCell
                      className={`text-[11px] ${row.error ? "text-danger" : "text-textDim"}`}
                    >
                      <OverflowTooltip
                        content={row.error || ""}
                        className="max-w-64"
                      >
                        {row.error || "-"}
                      </OverflowTooltip>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </tbody>
        </DataTable>

        <div className="flex flex-col items-center gap-4 px-5 py-3 text-xs text-textDim">
          {totalLogsCount !== null && (
            <span>
              Showing {rows.length} of {totalLogsCount} logs
            </span>
          )}
          {totalLogsCount !== null && rows.length < totalLogsCount && (
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              Load more
            </Button>
          )}
        </div>
      </Card>
    </section>
  )
}
