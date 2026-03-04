import { X } from "lucide-react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/Button"
import {
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  ModalPanel,
  ModalTitle,
} from "../ui/Modal"

interface RotateKeyModalProps {
  isOpen: boolean
  result: string
  isRotating: boolean
  onClose: () => void
  onConfirm: () => void
}

export function RotateKeyModal({
  isOpen,
  result,
  isRotating,
  onClose,
  onConfirm,
}: RotateKeyModalProps) {
  return (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <ModalPanel>
        <ModalHeader>
          <ModalTitle>Rotate API Key</ModalTitle>
          <ModalCloseButton onClick={onClose}>
            <X size={14} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <p className="text-[13px] leading-[1.6] text-textDim">
            This will immediately invalidate the current key and generate a new
            one. Any static sites using the old key will stop sending events
            until updated.
          </p>

          <div
            className={cn(
              "break-all rounded border border-successDim bg-bg px-4 py-3.5 font-mono text-[12px] text-success",
              !result && "hidden",
            )}
          >
            {result}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isRotating}>
            {isRotating ? "Rotating…" : result ? "✓ Done" : "Rotate Key"}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalBackdrop>
  )
}
