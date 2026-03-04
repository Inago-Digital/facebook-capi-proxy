import { useCallback, useState } from "react"

import type { Site, SiteFormState } from "../components/types"
import type { ApiFetch } from "../context/AdminApiContext"
import { useToast } from "../context/ToastContext"

const EMPTY_SITE_FORM: SiteFormState = {
  id: "",
  name: "",
  domain: "",
  pixel: "",
  token: "",
  note: "",
}

interface CreateSiteResponse {
  api_key: string
}

interface RotateKeyResponse {
  api_key: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unexpected error"
}

export function useSites(apiFetch: ApiFetch) {
  const { addToast } = useToast()

  const [sites, setSites] = useState<Site[]>([])

  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [siteModalMode, setSiteModalMode] = useState<"create" | "edit">(
    "create",
  )
  const [siteForm, setSiteForm] = useState<SiteFormState>(EMPTY_SITE_FORM)
  const [isSavingSite, setIsSavingSite] = useState(false)

  const [rotateModalOpen, setRotateModalOpen] = useState(false)
  const [rotateSiteId, setRotateSiteId] = useState<string | null>(null)
  const [rotateResult, setRotateResult] = useState("")
  const [isRotating, setIsRotating] = useState(false)

  const loadSites = useCallback(async () => {
    try {
      const response = await apiFetch<Site[]>("/admin/sites")
      setSites(response)
      return response
    } catch (error) {
      addToast("Failed to load sites: " + getErrorMessage(error), "error")
      return null
    }
  }, [addToast, apiFetch])

  const openAddModal = useCallback(() => {
    setSiteModalMode("create")
    setSiteForm(EMPTY_SITE_FORM)
    setSiteModalOpen(true)
  }, [])

  const openEditModal = useCallback(
    (siteId: string) => {
      const site = sites.find((item) => item.id === siteId)
      if (!site) return

      setSiteModalMode("edit")
      setSiteForm({
        id: site.id,
        name: site.name || "",
        domain: site.domain || "",
        pixel: site.pixel_id || "",
        token: "",
        note: site.note || "",
      })
      setSiteModalOpen(true)
    },
    [sites],
  )

  const saveSite = useCallback(async () => {
    const id = siteForm.id.trim()
    const name = siteForm.name.trim()
    const domain = siteForm.domain.trim()
    const pixel = siteForm.pixel.trim()
    const token = siteForm.token.trim()
    const note = siteForm.note.trim()

    if (!name || !domain) {
      addToast("Name and domain are required", "error")
      return false
    }

    if (!id && (!pixel || !token)) {
      addToast("Pixel ID and token required for new sites", "error")
      return false
    }

    setIsSavingSite(true)

    try {
      if (id) {
        const body: Record<string, string> = { name, domain, note }
        if (pixel) body.pixel_id = pixel
        if (token) body.fb_token = token

        await apiFetch(`/admin/sites/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })

        addToast("Site updated", "success")
      } else {
        const created = await apiFetch<CreateSiteResponse>("/admin/sites", {
          method: "POST",
          body: JSON.stringify({
            name,
            domain,
            pixel_id: pixel,
            fb_token: token,
            note,
          }),
        })

        addToast("Site created. API key: " + created.api_key, "info")
      }

      setSiteModalOpen(false)
      setSiteForm(EMPTY_SITE_FORM)
      await loadSites()

      return true
    } catch (error) {
      addToast("Error: " + getErrorMessage(error), "error")
      return false
    } finally {
      setIsSavingSite(false)
    }
  }, [addToast, apiFetch, loadSites, siteForm])

  const deleteSite = useCallback(
    async (siteId: string, siteName: string) => {
      if (!window.confirm(`Delete "${siteName}"? This cannot be undone.`)) {
        return
      }

      try {
        await apiFetch(`/admin/sites/${siteId}`, { method: "DELETE" })
        addToast("Site deleted", "success")
        await loadSites()
      } catch (error) {
        addToast("Delete failed: " + getErrorMessage(error), "error")
      }
    },
    [addToast, apiFetch, loadSites],
  )

  const openRotateModal = useCallback((siteId: string) => {
    setRotateSiteId(siteId)
    setRotateResult("")
    setIsRotating(false)
    setRotateModalOpen(true)
  }, [])

  const confirmRotate = useCallback(async () => {
    if (!rotateSiteId) return

    setIsRotating(true)

    try {
      const response = await apiFetch<RotateKeyResponse>(
        `/admin/sites/${rotateSiteId}/rotate`,
        { method: "POST" },
      )

      setRotateResult("New key: " + response.api_key)
      addToast("Key rotated - copy the new key now", "success")
      await loadSites()
    } catch (error) {
      setRotateResult("")
      addToast("Rotate failed: " + getErrorMessage(error), "error")
    } finally {
      setIsRotating(false)
    }
  }, [addToast, apiFetch, loadSites, rotateSiteId])

  const changeSiteActivity = useCallback(
    async (siteId: string, active: boolean) => {
      try {
        await apiFetch(`/admin/sites/${siteId}`, {
          method: "PATCH",
          body: JSON.stringify({ active }),
        })
        addToast(`Site ${active ? "activated" : "deactivated"}`, "success")
        await loadSites()
      } catch (error) {
        addToast("Failed to update site: " + getErrorMessage(error), "error")
      }
    },
    [addToast, apiFetch, loadSites],
  )

  return {
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
    changeSiteActivity,

    rotateModalOpen,
    setRotateModalOpen,
    rotateResult,
    isRotating,
    openRotateModal,
    confirmRotate,
  }
}
