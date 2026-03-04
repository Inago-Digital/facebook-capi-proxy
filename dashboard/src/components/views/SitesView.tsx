import { Plus, RotateCw } from "lucide-react"
import { cn } from "../../utils/cn"
import { formatDate, isSiteActive } from "../site-utils"
import type { Site } from "../types"
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
import { OverflowTooltip } from "../ui/OverflowTooltip"

interface SitesViewProps {
  visible: boolean
  isConnected: boolean
  sites: Site[]
  onOpenAddModal: () => void
  onRefreshSites: () => void
  onOpenEditModal: (siteId: string) => void
  onOpenRotateModal: (siteId: string) => void
  onDeleteSite: (siteId: string, siteName: string) => void
  onChangeSiteActivity: (siteId: string, isActive: boolean) => void
}

export function SitesView({
  visible,
  isConnected,
  sites,
  onOpenAddModal,
  onRefreshSites,
  onOpenEditModal,
  onOpenRotateModal,
  onDeleteSite,
  onChangeSiteActivity,
}: SitesViewProps) {
  return (
    <section
      className={cn("hidden flex-col gap-6", visible && "flex")}
      id="view-sites"
    >
      <PageHeader
        title="Sites"
        subtitle="Manage per-site Pixel IDs, tokens, and API keys"
        action={
          <Button onClick={onOpenAddModal}>
            <Plus size={14} />
            New Site
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Sites</CardTitle>
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
              <TableHeadCell>Created</TableHeadCell>
              <TableHeadCell>Note</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <tr>
                <EmptyTableCell colSpan={7}>
                  {isConnected ? "No sites yet" : "Connect to load sites"}
                </EmptyTableCell>
              </tr>
            ) : (
              sites.map((site) => {
                const isActive = isSiteActive(site)

                return (
                  <TableRow key={site.id}>
                    <TableCell className="text-white">{site.name}</TableCell>
                    <TableCell className="text-accent">{site.domain}</TableCell>
                    <TableCell className="text-textDim">
                      {site.pixel_id}
                    </TableCell>
                    <TableCell>
                      <Badge tone={isActive ? "green" : "red"}>
                        {isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-textDim">
                      {formatDate(site.created_at)}
                    </TableCell>
                    <TableCell className="truncate text-textDim">
                      <OverflowTooltip
                        content={site.note || "No note"}
                        className="max-w-xs"
                      >
                        {site.note || "-"}
                      </OverflowTooltip>
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
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteSite(site.id, site.name)}
                        >
                          Delete
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
