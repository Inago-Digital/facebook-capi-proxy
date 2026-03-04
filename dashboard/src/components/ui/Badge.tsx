import type { HTMLAttributes } from "react"

import { cn } from "../../utils/cn"

type BadgeTone = "green" | "red" | "amber" | "blue"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone
}

const baseClass =
  "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[3px] px-2 py-[3px] font-mono text-[11px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-current before:content-['']"

const toneClass: Record<BadgeTone, string> = {
  green: "bg-successDim text-success",
  red: "bg-dangerDim text-danger",
  amber: "bg-warningDim text-warning",
  blue: "bg-[rgba(24,119,242,0.12)] text-accent",
}

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(baseClass, toneClass[tone], className)} {...props} />
}
