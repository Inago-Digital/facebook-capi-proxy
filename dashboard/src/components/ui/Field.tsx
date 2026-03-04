import type { HTMLAttributes } from "react"

import { cn } from "../../utils/cn"

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

export function FieldLabel({
  className,
  ...props
}: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.06em] text-textDim",
        className,
      )}
      {...props}
    />
  )
}

export function FieldHint({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("mt-0.5 text-[11px] text-textMute", className)} {...props} />
}
