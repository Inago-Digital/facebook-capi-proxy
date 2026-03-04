import type { InputHTMLAttributes, SelectHTMLAttributes } from "react"

import { cn } from "../../utils/cn"

const inputBaseClass =
  "w-full rounded border border-borderStrong bg-bg px-3 py-[9px] font-mono text-[12px] text-text outline-none transition-colors duration-150 placeholder:text-textMute focus:border-accent"

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBaseClass, className)} {...props} />
}

export const textInputClass = inputBaseClass
