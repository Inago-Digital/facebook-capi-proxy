import { useEffect, useMemo, useState } from "react"

import { useAdminApi } from "../context/AdminApiContext"
import { useToast } from "../context/ToastContext"
import { useLogs } from "../hooks/useLogs"
import { useSites } from "../hooks/useSites"
import { useSnippet } from "../hooks/useSnippet"
import { RotateKeyModal } from "./modals/RotateKeyModal"
import { SiteModal } from "./modals/SiteModal"
import { Sidebar } from "./Sidebar"
import { isSiteActive } from "../utils/site"
import { Topbar } from "./Topbar"
import type { ViewName } from "../utils/types"
import { LogsView } from "./views/LogsView"
import { OverviewView } from "./views/OverviewView"
import { SitesView } from "./views/SitesView"
import { SnippetView } from "./views/SnippetView"
import { DeleteSiteModal } from "./modals/DeleteSiteModal"

const VIEW_NAMES: ViewName[] = ["overview", "sites", "logs", "snippet"]

function resolveViewFromHash(hash: string): ViewName {
  const nextView = hash.replace(/^#/, "")
  return VIEW_NAMES.includes(nextView as ViewName)
    ? (nextView as ViewName)
    : "overview"
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewName>("overview")
  const [deleteSiteModalOpen, setDeleteSiteModalOpen] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const {
    apiFetch,
    envLabel,
    proxyUrl,
    isConnected,
    healthLabel,
    healthColor,
    healthTimestamp,
    logout,
  } = useAdminApi()

  const {
    sites,
    setSites,
    loadSites,
    siteModalOpen,
    setSiteModalOpen,
    siteModalMode,
    siteForm,
    setSiteForm,
    isSavingSite,
    openAddModal,
    openEditModal,
    saveSite,
    deleteSite,
    rotateModalOpen,
    setRotateModalOpen,
    rotateResult,
    isRotating,
    openRotateModal,
    confirmRotate,
    changeSiteActivity,
  } = useSites(apiFetch)

  const {
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
  } = useLogs(apiFetch)

  const {
    snippetSiteId,
    setSnippetSiteId,
    snippetTag,
    snippetUsage,
    buildSnippet,
    copySnippetTag,
    copyKey,
  } = useSnippet(sites)

  const activeSiteCount = useMemo(
    () => sites.filter((site) => isSiteActive(site)).length,
    [sites],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const syncViewFromHash = () => {
      setActiveView(resolveViewFromHash(window.location.hash))
    }

    syncViewFromHash()
    window.addEventListener("hashchange", syncViewFromHash)

    return () => window.removeEventListener("hashchange", syncViewFromHash)
  }, [])

  useEffect(() => {
    if (isConnected) {
      void loadSites()
      return
    }

    setSites([])
    setLogsSiteId("")
    setLogRows([])
    setLogsLoadError(false)
    setSnippetSiteId("")
  }, [
    isConnected,
    loadSites,
    setLogRows,
    setLogsLoadError,
    setLogsSiteId,
    setSites,
    setSnippetSiteId,
  ])

  useEffect(() => {
    setLogsSiteId((current) =>
      sites.some((site) => site.id === current) ? current : "",
    )
    setSnippetSiteId((current) =>
      sites.some((site) => site.id === current) ? current : "",
    )
  }, [sites, setLogsSiteId, setSnippetSiteId])

  const viewLogs = (siteId: string) => {
    window.location.hash = "logs"
    setLogsSiteId(siteId)
    setActiveView("logs")
    void loadLogs(siteId)
  }

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-bg font-sans text-[14px] leading-[1.5] text-text">
        <div className="pointer-events-none fixed inset-0 z-[9999] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]"></div>
        <div className="relative grid h-screen grid-cols-[220px_1fr] grid-rows-[48px_1fr] max-[900px]:grid-cols-1">
          <Topbar
            envLabel={envLabel}
            onLogout={() => {
              void logout()
            }}
          />

          <Sidebar
            activeView={activeView}
            siteCount={sites.length}
            onChangeView={(view) => {
              setActiveView(view)
              if (view === "overview") {
                history.pushState(
                  "",
                  document.title,
                  window.location.pathname + window.location.search,
                )
              } else {
                window.location.hash = view
              }

              if (view === "snippet") buildSnippet()
            }}
          />

          <main className="flex flex-col gap-6 overflow-y-auto px-8 py-7 max-[900px]:px-5 max-[900px]:py-5">
            <OverviewView
              visible={activeView === "overview"}
              isConnected={isConnected}
              sites={sites}
              activeSiteCount={activeSiteCount}
              healthLabel={healthLabel}
              healthColor={healthColor}
              healthTimestamp={healthTimestamp}
              proxyUrl={proxyUrl}
              onOpenAddModal={openAddModal}
              onRefreshSites={() => {
                void loadSites()
              }}
              onOpenEditModal={openEditModal}
              onOpenRotateModal={openRotateModal}
              onViewLogs={viewLogs}
              onDeleteSite={(siteId, siteName) => {
                setSiteToDelete({ id: siteId, name: siteName })
                setDeleteSiteModalOpen(true)
              }}
              onCopyKey={copyKey}
              onChangeSiteActivity={changeSiteActivity}
            />

            <SitesView
              visible={activeView === "sites"}
              isConnected={isConnected}
              sites={sites}
              onOpenAddModal={openAddModal}
              onRefreshSites={() => {
                void loadSites()
              }}
              onOpenEditModal={openEditModal}
              onOpenRotateModal={openRotateModal}
              onDeleteSite={(siteId, siteName) => {
                setSiteToDelete({ id: siteId, name: siteName })
                setDeleteSiteModalOpen(true)
              }}
              onChangeSiteActivity={changeSiteActivity}
            />

            <LogsView
              visible={activeView === "logs"}
              isConnected={isConnected}
              sites={sites}
              selectedSiteId={logsSiteId}
              limit={logsLimit}
              isLoading={isLogsLoading}
              hasError={logsLoadError}
              rows={logRows}
              totalLogsCount={totalLogsCount}
              onSelectedSiteChange={setLogsSiteId}
              onLimitChange={(next) => {
                const safeLimit = Math.max(1, Math.min(500, next))
                setLogsLimit(safeLimit)
              }}
              onLoad={() => {
                void loadLogs()
              }}
              onLoadMore={() => {
                void loadMoreLogs()
              }}
            />

            <SnippetView
              visible={activeView === "snippet"}
              sites={sites}
              siteId={snippetSiteId}
              scriptTagSnippet={snippetTag}
              usageSnippet={snippetUsage}
              onSiteChange={setSnippetSiteId}
              onCopyTag={copySnippetTag}
            />
          </main>
        </div>
      </div>

      <SiteModal
        isOpen={siteModalOpen}
        mode={siteModalMode}
        form={siteForm}
        isSaving={isSavingSite}
        onChange={(field, value) => {
          setSiteForm((prev) => ({ ...prev, [field]: value }))
        }}
        onClose={() => setSiteModalOpen(false)}
        onSave={() => {
          void saveSite()
        }}
      />

      <RotateKeyModal
        isOpen={rotateModalOpen}
        result={rotateResult}
        isRotating={isRotating}
        onClose={() => setRotateModalOpen(false)}
        onConfirm={() => {
          void confirmRotate()
        }}
      />

      <DeleteSiteModal
        isOpen={deleteSiteModalOpen}
        itemName={siteToDelete?.name || ""}
        onClose={() => setDeleteSiteModalOpen(false)}
        onDelete={() => {
          void deleteSite(siteToDelete?.id!, siteToDelete?.name!)
          setDeleteSiteModalOpen(false)
        }}
      />
    </>
  )
}
