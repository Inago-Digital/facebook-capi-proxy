import type { ToastMessage } from "./types"
import { Toast } from "./ui/Toast"

interface ToastListProps {
  toasts: ToastMessage[]
}

export function ToastList({ toasts }: ToastListProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} tone={toast.type}>
          {toast.message}
        </Toast>
      ))}
    </div>
  )
}
