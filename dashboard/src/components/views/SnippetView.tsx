import { cn } from "../../utils/cn"
import type { Site } from "../../utils/types"
import { Button } from "../ui/Button"
import { Card, CardHeader, CardTitle } from "../ui/Card"
import { Field, FieldLabel } from "../ui/Field"
import { PageHeader } from "../ui/PageHeader"
import hljs from "highlight.js"
import { Select } from "../ui/Select"
import { Copy } from "lucide-react"

interface SnippetViewProps {
  visible: boolean
  sites: Site[]
  siteId: string
  scriptTagSnippet: string
  usageSnippet: string
  onSiteChange: (value: string) => void
  onCopyTag: () => void
}

export function SnippetView({
  visible,
  sites,
  siteId,
  scriptTagSnippet,
  usageSnippet,
  onSiteChange,
  onCopyTag,
}: SnippetViewProps) {
  return (
    <section
      className={cn("hidden flex-col gap-6", visible && "flex")}
      id="view-snippet"
    >
      <PageHeader
        title="Client Snippet"
        subtitle="Copy this into any static site"
      />

      <Card>
        <CardHeader>
          <CardTitle>Configure</CardTitle>
        </CardHeader>

        <div className="gap-3 p-5">
          <Field>
            <FieldLabel>Site API Key</FieldLabel>
            <Select
              options={sites.map((site) => ({
                label: site.name,
                description: site.domain,
                value: site.id,
              }))}
              value={siteId}
              onChange={(value) => onSiteChange(value as string)}
              placeholder="Select a site"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script tag</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCopyTag}>
            <Copy size={14} />
            Copy
          </Button>
        </CardHeader>
        <div
          className="overflow-x-auto whitespace-pre border-0 bg-bg px-4 py-4 font-mono text-[12px] leading-[1.6]"
          dangerouslySetInnerHTML={{
            __html: hljs.highlight(scriptTagSnippet, { language: "html" })
              .value,
          }}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage examples</CardTitle>
        </CardHeader>
        <div
          className="overflow-x-auto whitespace-pre border-0 bg-bg px-4 py-4 font-mono text-[12px] leading-[1.6]"
          dangerouslySetInnerHTML={{
            __html: hljs.highlight(usageSnippet, { language: "javascript" })
              .value,
          }}
        />
      </Card>
    </section>
  )
}
