import { LogOut } from "lucide-react"
import { Button } from "./ui/Button"

interface TopbarProps {
  envLabel: string
  onLogout: () => void
}

export function Topbar({ envLabel, onLogout }: TopbarProps) {
  return (
    <header className="col-span-full flex items-center gap-3 border-b border-border bg-surface px-5">
      <div className="flex items-center gap-2 font-mono text-[13px] font-semibold tracking-[0.04em] text-white">
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_#1877f2] animate-pulseDot"></span>
        CAPI_PROXY
      </div>
      <div className="flex-1"></div>
      <div className="rounded-[3px] border border-borderStrong px-2 py-[3px] font-mono text-[11px] text-textDim">
        {envLabel}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onLogout}>
          <LogOut size={14} />
          Logout
        </Button>
      </div>
    </header>
  )
}
