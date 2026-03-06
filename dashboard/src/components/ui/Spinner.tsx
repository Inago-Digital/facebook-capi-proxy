import type { HTMLAttributes } from "react"

import { cn } from "../../utils/cn"

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  const sizeClass =
    size === "sm"
      ? "w-4 h-4 border-2"
      : size === "lg"
        ? "w-12 h-12 border-4"
        : "w-8 h-8 border-2"

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-borderStrong border-t-accent",
        sizeClass,
        className,
      )}
      {...props}
    />
  )
}
