import { cn } from "../../utils/cn"
import { formatDate } from "../site-utils"
import type { Site, SiteLog } from "../types"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Card, CardHeader, CardTitle } from "../ui/Card"
import { TextInput } from "../ui/Input"
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
  onSelectedSiteChange: (siteId: string) => void
  onLimitChange: (limit: number) => void
  onLoad: () => void
}

export function LogsView({
  visible,
  isConnected,
  sites,
  selectedSiteId,
  limit,
  isLoading,
  hasError,
  rows,
  onSelectedSiteChange,
  onLimitChange,
  onLoad,
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

          <TextInput
            className="w-20"
            type="number"
            value={limit}
            min={1}
            max={500}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              onLimitChange(Number.isNaN(next) ? 50 : next)
            }}
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
                  <Spinner className="mx-auto" />
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
                    <TableCell className="text-[11px] text-danger">
                      {row.error || ""}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </tbody>
        </DataTable>
      </Card>
    </section>
  )
}
