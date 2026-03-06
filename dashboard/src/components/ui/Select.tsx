import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  useFloating,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
} from "@floating-ui/react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../utils/cn"
import { motion } from "framer-motion"

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  icon?: React.ReactNode
  description?: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string | number | null
  onChange?: (value: string | number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  maxHeight?: number
  noOptionsMessage?: string
}

export function Select({
  options,
  value = null,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  maxHeight = 256,
  noOptionsMessage = "No options found",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ fallbackPlacements: ["top-start"] }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`
        },
      }),
    ],
  })

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  )

  const handleSelect = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return
      onChange?.(option.value)
      setIsOpen(false)
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case "Enter":
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else if (
            highlightedIndex >= 0 &&
            highlightedIndex < options.length
          ) {
            handleSelect(options[highlightedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          break
        case "ArrowDown":
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else {
            setHighlightedIndex((prev) =>
              prev < options.length - 1 ? prev + 1 : 0,
            )
          }
          break
        case "ArrowUp":
          e.preventDefault()
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : options.length - 1,
            )
          }
          break
      }
    },
    [disabled, isOpen, highlightedIndex, options, handleSelect],
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement
      highlightedElement?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  const dropdown = isOpen && (
    <div
      ref={(node) => {
        dropdownRef.current = node
        refs.setFloating(node)
      }}
      className="z-50 bg-bg w-full rounded border border-borderStrong bg-bg outline-none"
      style={floatingStyles}
    >
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ maxHeight }}
        role="listbox"
      >
        {options.length === 0 ? (
          <div className="text-center font-mono py-2 text-[12px] text-textDim">
            {noOptionsMessage}
          </div>
        ) : (
          options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === highlightedIndex

            return (
              <div
                key={option.value}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                      flex items-center justify-between px-3 py-[9px] cursor-pointer transition-colors duration-150
                      ${isSelected ? "bg-textDim/20" : ""}
                      ${isHighlighted ? "bg-textDim/10" : ""}
                      ${option.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-textDim/10"}
                    `}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {option.icon && (
                    <span className="w-4 h-4 shrink-0">{option.icon}</span>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[12px] text-text truncate">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="font-mono text-[11px] text-textDim truncate">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && <Check size={16} className="text-text" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  const canUseDOM = typeof document !== "undefined"

  return (
    <div className={cn("relative w-full", className)} onKeyDown={handleKeyDown}>
      <div
        ref={(node) => {
          triggerRef.current = node
          refs.setReference(node)
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full flex rounded border border-borderStrong bg-bg px-3 py-[9px] font-mono text-[12px] text-text outline-none placeholder:text-textMute cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed bg-bg",
        )}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex-1 min-w-0 mr-2">
          {selectedOption ? (
            <span className="flex items-center gap-2 text-text">
              {selectedOption.icon && (
                <span className="w-4 h-4">{selectedOption.icon}</span>
              )}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-textDim">{placeholder}</span>
          )}
        </div>
        <motion.div
          className="flex items-center gap-1 shrink-0"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="w-4 h-4 text-textDim">
            <ChevronDown size={16} />
          </span>
        </motion.div>
      </div>

      {canUseDOM && createPortal(dropdown, document.body)}
    </div>
  )
}
