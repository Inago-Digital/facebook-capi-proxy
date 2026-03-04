import type { HTMLAttributes } from "react"

import { cn } from "../../utils/cn"

type ToastTone = "success" | "error" | "info"

interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  tone: ToastTone
}

const toneClass: Record<ToastTone, string> = {
  success: "border-l-[3px] border-l-success",
  error: "border-l-[3px] border-l-danger",
  info: "border-l-[3px] border-l-accent",
}

export function Toast({ tone, className, ...props }: ToastProps) {
  return (
    <div
      className={cn(
        "flex max-w-[360px] items-center gap-2.5 rounded-md border border-borderStrong bg-surfaceAlt px-4 py-3 font-mono text-[12px] text-text shadow-toast animate-toastIn",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}
