import { useCallback, useEffect, useState } from "react"

import type { Site } from "../utils/types"
import { useToast } from "../context/ToastContext"
import { resolveApiBaseUrl } from "../config/api-base"

const DEFAULT_SNIPPET_USAGE = `// PageView fires automatically on load

// Purchase event
fbCapi('Purchase', {
  value: 49.99,
  currency: 'USD',
  content_ids: ['SKU-123']
});

// Lead with hashed user data (client hashes automatically)
fbCapi('Lead', {}, {
  email: 'user@example.com',
  phone: '+15551234567'
});

// Test mode
fbCapi('ViewContent', {}, {}, {
  test_event_code: 'TEST12345'
});`

export function useSnippet(sites: Site[]) {
  const { addToast } = useToast()

  const [snippetSiteId, setSnippetSiteId] = useState("")
  const [snippetTag, setSnippetTag] = useState("Loading…")
  const [snippetUsage, setSnippetUsage] = useState("Loading…")

  const buildSnippet = useCallback(() => {
    const generatedUrl = `${resolveApiBaseUrl()}/event`
    const selectedSite = sites.find((site) => site.id === snippetSiteId)
    const apiKey = selectedSite?.api_key || "capi_YOUR_KEY_HERE"

    setSnippetTag(`<!-- Add before </body> -->
<script>
  var CAPI_PROXY = '${generatedUrl}';
  var CAPI_KEY   = '${apiKey}';
</script>
<script src="${resolveApiBaseUrl()}/fb-capi-client.js"></script>`)

    setSnippetUsage(DEFAULT_SNIPPET_USAGE)
  }, [sites, snippetSiteId])

  useEffect(() => {
    buildSnippet()
  }, [buildSnippet])

  const copySnippetTag = useCallback(() => {
    if (!navigator.clipboard) {
      addToast("Clipboard is not available in this browser", "error")
      return
    }

    navigator.clipboard
      .writeText(snippetTag)
      .then(() => addToast("Copied to clipboard", "success"))
      .catch(() => addToast("Failed to copy snippet", "error"))
  }, [addToast, snippetTag])

  const copyKey = useCallback(
    (key: string) => {
      if (!key || key === "-") return

      if (!navigator.clipboard) {
        addToast("Clipboard is not available in this browser", "error")
        return
      }

      navigator.clipboard
        .writeText(key)
        .then(() => addToast("API key copied", "success"))
        .catch(() => addToast("Failed to copy API key", "error"))
    },
    [addToast],
  )

  return {
    snippetSiteId,
    setSnippetSiteId,
    snippetTag,
    snippetUsage,
    buildSnippet,
    copySnippetTag,
    copyKey,
  }
}
