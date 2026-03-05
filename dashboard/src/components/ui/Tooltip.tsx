import React, { useEffect, useRef, useState } from "react"
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react"
import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import { cn } from "../../utils/cn"

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  placement?: "top" | "bottom" | "left" | "right"
  delay?: number
  className?: string
  disabled?: boolean
}

export default function Tooltip({
  children,
  content,
  placement = "top",
  delay = 0,
  className,
  disabled = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const openTimeout = useRef<number>(0)
  const closeTimeout = useRef<number>(0)

  const { refs, floatingStyles } = useFloating({
    placement,
    open: isOpen,
    onOpenChange: setIsOpen,
    transform: false,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  useEffect(() => {
    return () => {
      window.clearTimeout(openTimeout.current)
      window.clearTimeout(closeTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (!disabled) return
    window.clearTimeout(openTimeout.current)
    window.clearTimeout(closeTimeout.current)
    closeTimeout.current = window.setTimeout(() => setIsOpen(false), 0)
    return () => window.clearTimeout(closeTimeout.current)
  }, [disabled])

  const handleMouseEnter = () => {
    if (disabled) return
    window.clearTimeout(closeTimeout.current)
    openTimeout.current = window.setTimeout(() => setIsOpen(true), delay)
  }

  const handleMouseLeave = () => {
    if (disabled) return
    window.clearTimeout(openTimeout.current)
    closeTimeout.current = window.setTimeout(() => setIsOpen(false), 80)
  }

  const canUseDOM = typeof document !== "undefined"

  return (
    <>
      <div
        ref={(node) => refs.setReference(node)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn("inline-block max-w-full", className)}
      >
        {children}
      </div>

      {canUseDOM &&
        createPortal(
          <AnimatePresence>
            {!disabled && isOpen && (
              <motion.div
                ref={(node) => {
                  refs.setFloating(node)
                }}
                style={floatingStyles}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="text-text max-w-[640px] z-50 pointer-events-none px-2 py-1 text-xs bg-bg border border-border rounded break-words"
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
