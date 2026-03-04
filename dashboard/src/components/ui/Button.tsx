import type { ButtonHTMLAttributes } from "react"

import { cn } from "../../utils/cn"

type ButtonVariant = "primary" | "ghost" | "danger"
type ButtonSize = "md" | "sm"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-transparent font-mono font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"

const variantClass: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent text-white hover:bg-[#1a6de0]",
  ghost: "border-borderStrong bg-transparent text-textDim hover:border-textDim hover:text-text",
  danger: "border-dangerDim bg-transparent text-danger hover:bg-dangerDim",
}

const sizeClass: Record<ButtonSize, string> = {
  md: "px-3.5 py-[7px] text-[12px]",
  sm: "px-2.5 py-1 text-[11px]",
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(baseClass, variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  )
}
