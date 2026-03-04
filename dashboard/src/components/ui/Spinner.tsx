import type { HTMLAttributes } from "react"

import { cn } from "../../utils/cn"

export function Spinner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-3.5 w-3.5 animate-spin rounded-full border-2 border-borderStrong border-t-accent",
        className,
      )}
      {...props}
    />
  )
}
