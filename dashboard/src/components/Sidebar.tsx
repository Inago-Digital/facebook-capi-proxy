import { Code, Globe, LayoutDashboard, Logs, Activity } from "lucide-react"
import { cn } from "../utils/cn"
import type { ViewName } from "./types"

interface SidebarProps {
  activeView: ViewName
  siteCount: number
  onChangeView: (view: ViewName) => void
}

export function Sidebar({ activeView, siteCount, onChangeView }: SidebarProps) {
  const navItemClass = (isActive: boolean) =>
    cn(
      "flex cursor-pointer select-none items-center gap-2.5 border-l-2 border-transparent px-4 py-2 text-[13px] text-textDim transition-all duration-150 hover:bg-surfaceAlt hover:text-text",
      isActive && "border-l-accent bg-[rgba(24,119,242,0.08)] text-white",
    )

  return (
    <nav className="flex flex-col gap-0.5 border-r border-border bg-surface py-4 max-[900px]:hidden">
      <div className="px-4 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-textMute">
        Navigation
      </div>

      <div
        className={navItemClass(activeView === "overview")}
        onClick={() => onChangeView("overview")}
      >
        <span
          className={cn(
            "h-4 w-4 shrink-0 opacity-60",
            activeView === "overview" && "opacity-100",
          )}
        >
          <LayoutDashboard size={16} />
        </span>
        Overview
        <span className="ml-auto rounded-[10px] bg-accentDim px-1.5 py-[1px] font-mono text-[10px] text-accent">
          {siteCount}
        </span>
      </div>

      <div
        className={navItemClass(activeView === "sites")}
        onClick={() => onChangeView("sites")}
      >
        <span
          className={cn(
            "h-4 w-4 shrink-0 opacity-60",
            activeView === "overview" && "opacity-100",
          )}
        >
          <Globe size={16} />
        </span>
        Sites
      </div>

      <div
        className={navItemClass(activeView === "logs")}
        onClick={() => onChangeView("logs")}
      >
        <span
          className={cn(
            "h-4 w-4 shrink-0 opacity-60",
            activeView === "overview" && "opacity-100",
          )}
        >
          <Logs size={16} />
        </span>
        Event Logs
      </div>

      <div
        className={navItemClass(activeView === "snippet")}
        onClick={() => onChangeView("snippet")}
      >
        <span
          className={cn(
            "h-4 w-4 shrink-0 opacity-60",
            activeView === "overview" && "opacity-100",
          )}
        >
          <Code size={16} />
        </span>
        Client Snippet
      </div>

      <div className="mt-auto px-4 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-textMute">
        System
      </div>
      <div className={navItemClass(false)}>
        <span className="h-4 w-4 shrink-0 opacity-60">
          <Activity size={16} />
        </span>
        Health
      </div>
    </nav>
  )
}
