import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"

import { cn } from "../../utils/cn"

interface ModalBackdropProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalBackdrop({
  isOpen,
  onClose,
  children,
}: ModalBackdropProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] hidden items-center justify-center bg-black/75 p-5 backdrop-blur-[4px]",
        isOpen && "flex",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

export function ModalPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full max-w-[540px] animate-modalIn rounded-lg border border-borderStrong bg-surface shadow-panel",
        className,
      )}
      {...props}
    />
  )
}

export function ModalHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border px-6 py-[18px]",
        className,
      )}
      {...props}
    />
  )
}

export function ModalTitle({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-mono text-[14px] font-semibold text-white", className)} {...props} />
}

export function ModalCloseButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "rounded-[3px] border-0 bg-transparent px-1.5 py-0.5 text-[20px] leading-none text-textDim transition-colors duration-150 hover:text-text",
        className,
      )}
      {...props}
    />
  )
}

export function ModalBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 px-6 py-6", className)} {...props} />
}

export function ModalFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-2 border-t border-border px-6 py-4", className)} {...props} />
}
