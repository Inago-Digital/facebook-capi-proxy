import { X } from "lucide-react"
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

interface DeleteSiteModalProps {
  isOpen: boolean
  itemName: string
  onClose: () => void
  onDelete: () => void
}

export function DeleteSiteModal({
  isOpen,
  itemName,
  onClose,
  onDelete,
}: DeleteSiteModalProps) {
  return (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <ModalPanel>
        <ModalHeader>
          <ModalTitle>Confirm Deletion</ModalTitle>
          <ModalCloseButton onClick={onClose}>
            <X size={14} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <p className="text-[13px] leading-[1.6] text-textDim">
            Are you sure you want to delete <strong>{itemName}</strong>? This
            action cannot be undone.
          </p>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalBackdrop>
  )
}
