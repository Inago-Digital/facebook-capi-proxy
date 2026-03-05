import { Copy, Plus, RotateCw } from "lucide-react"
import { cn } from "../../utils/cn"
import { isSiteActive } from "../../utils/site"
import type { Site } from "../../utils/types"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Card, CardHeader, CardTitle } from "../ui/Card"
import { PageHeader } from "../ui/PageHeader"
import {
  DataTable,
  EmptyTableCell,
  TableCell,
  TableHeadCell,
  TableRow,
} from "../ui/Table"
import Tooltip from "../ui/Tooltip"

interface OverviewViewProps {
  visible: boolean
  isConnected: boolean
  sites: Site[]
  activeSiteCount: number
  healthLabel: string
  healthColor: string
  healthTimestamp: string
  proxyUrl: string
  onOpenAddModal: () => void
  onRefreshSites: () => void
  onOpenEditModal: (siteId: string) => void
  onOpenRotateModal: (siteId: string) => void
  onViewLogs: (siteId: string) => void
  onDeleteSite: (siteId: string, siteName: string) => void
  onCopyKey: (value: string) => void
  onChangeSiteActivity: (siteId: string, isActive: boolean) => void
}

const statCardClass = "rounded-md border border-border bg-surface p-4"
const statLabelClass =
  "mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-textMute"
const statValueClass =
  "font-mono text-[28px] font-semibold leading-none text-white"
const statDeltaClass = "mt-1.5 font-mono text-[11px] text-success"

export function OverviewView({
  visible,
  isConnected,
  sites,
  activeSiteCount,
  healthLabel,
  healthColor,
  healthTimestamp,
  proxyUrl,
  onOpenAddModal,
  onRefreshSites,
  onOpenEditModal,
  onOpenRotateModal,
  onViewLogs,
  onDeleteSite,
  onCopyKey,
  onChangeSiteActivity,
}: OverviewViewProps) {
  return (
    <section
      className={cn("hidden flex-col gap-6", visible && "flex")}
      id="view-overview"
    >
      <PageHeader
        title="Overview"
        subtitle="Multi-tenant Facebook CAPI Proxy"
        action={
          <Button onClick={onOpenAddModal}>
            <Plus size={14} />
            New Site
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        <div className={statCardClass}>
          <div className={statLabelClass}>Total Sites</div>
          <div className={statValueClass}>{sites.length}</div>
          <div className={statDeltaClass}>{activeSiteCount} active</div>
        </div>

        <div className={statCardClass}>
          <div className={statLabelClass}>Active</div>
          <div className={statValueClass}>{activeSiteCount}</div>
          <div className={statDeltaClass}>sites enabled</div>
        </div>

        <div className={statCardClass}>
          <div className={statLabelClass}>Server</div>
          <div className={cn("pt-[7px] font-mono text-[14px]", healthColor)}>
            {healthLabel}
          </div>
          <div className={statDeltaClass}>{healthTimestamp}</div>
        </div>

        <div className={statCardClass}>
          <div className={statLabelClass}>Proxy URL</div>
          <div className="break-all pt-[10px] font-mono text-[11px] text-textDim">
            {proxyUrl}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefreshSites}>
            <RotateCw size={14} />
            Refresh
          </Button>
        </CardHeader>

        <DataTable>
          <thead>
            <tr>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Domain</TableHeadCell>
              <TableHeadCell>Pixel ID</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>API Key</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <tr>
                <EmptyTableCell colSpan={6}>
                  {isConnected
                    ? "No sites yet - create one"
                    : "Connect to load sites"}
                </EmptyTableCell>
              </tr>
            ) : (
              sites.map((site) => {
                const isActive = isSiteActive(site)
                const apiKey = site.api_key || "-"

                return (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium text-white">
                      {site.name}
                    </TableCell>
                    <TableCell>
                      <a
                        href={site.domain}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent no-underline"
                      >
                        {site.domain}
                      </a>
                    </TableCell>
                    <TableCell className="text-textDim">
                      {site.pixel_id}
                    </TableCell>
                    <TableCell>
                      <Badge tone={isActive ? "green" : "red"}>
                        {isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip content="Click to copy">
                        <span
                          className="inline-flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-[3px] border border-border bg-bg px-2 py-[3px] font-mono text-[11px] text-textDim transition-all duration-150 hover:border-accent hover:text-text"
                          onClick={() => onCopyKey(apiKey)}
                        >
                          <span className="truncate">{apiKey}</span>
                          <Copy size={14} className="text-textDim" />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditModal(site.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onChangeSiteActivity(site.id, !isActive)
                          }
                        >
                          {isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenRotateModal(site.id)}
                        >
                          <RotateCw size={14} className="text-textDim" />
                          Key
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewLogs(site.id)}
                        >
                          Logs
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteSite(site.id, site.name)}
                        >
                          Del
                        </Button>
                      </div>
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
