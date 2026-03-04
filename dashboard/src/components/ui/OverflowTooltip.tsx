import { useEffect, useRef, useState } from "react"
import { cn } from "../../utils/cn"
import Tooltip from "./Tooltip"

interface OverflowTooltipProps {
  content: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function OverflowTooltip({
  content,
  className,
  children,
}: OverflowTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const checkOverflow = () => {
      const isOverflownX = el.scrollWidth > el.clientWidth
      const isOverflownY = el.scrollHeight > el.clientHeight
      setIsOverflowing(isOverflownX || isOverflownY)
    }

    checkOverflow()

    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(el)

    return () => resizeObserver.disconnect()
  }, [children, className])

  return (
    <Tooltip
      content={content}
      className="block w-full"
      disabled={!isOverflowing}
    >
      <div ref={ref} className={cn("truncate min-w-0", className ?? "")}>
        {children}
      </div>
    </Tooltip>
  )
}
