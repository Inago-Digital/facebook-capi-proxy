import { X } from "lucide-react"
import type { SiteFormState } from "../../utils/types"
import { Button } from "../ui/Button"
import { Field, FieldHint, FieldLabel } from "../ui/Field"
import { TextInput } from "../ui/Input"
import {
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  ModalPanel,
  ModalTitle,
} from "../ui/Modal"

interface SiteModalProps {
  isOpen: boolean
  mode: "create" | "edit"
  form: SiteFormState
  isSaving: boolean
  onChange: (field: keyof SiteFormState, value: string) => void
  onClose: () => void
  onSave: () => void
}

export function SiteModal({
  isOpen,
  mode,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: SiteModalProps) {
  const title = mode === "edit" ? "Edit Site" : "New Site"
  const submitLabel = mode === "edit" ? "Save Changes" : "Create Site"

  return (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <ModalPanel>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalCloseButton onClick={onClose}>
            <X size={14} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel>Site Name</FieldLabel>
              <TextInput
                value={form.name}
                placeholder="My Shop"
                onChange={(event) => onChange("name", event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Domain (origin)</FieldLabel>
              <TextInput
                value={form.domain}
                placeholder="https://myshop.com"
                onChange={(event) => onChange("domain", event.target.value)}
              />
              <FieldHint>Must match the site's origin exactly</FieldHint>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel>Facebook Pixel ID</FieldLabel>
              <TextInput
                value={form.pixel}
                placeholder="1234567890123456"
                onChange={(event) => onChange("pixel", event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>FB Access Token</FieldLabel>
              <TextInput
                type="password"
                value={form.token}
                placeholder="EAAxxxx…"
                onChange={(event) => onChange("token", event.target.value)}
              />
              <FieldHint>
                System User token with ads_management permission
              </FieldHint>
            </Field>
          </div>

          <Field>
            <FieldLabel>Note (optional)</FieldLabel>
            <TextInput
              value={form.note}
              placeholder="Internal memo…"
              onChange={(event) => onChange("note", event.target.value)}
            />
          </Field>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving…" : submitLabel}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalBackdrop>
  )
}
