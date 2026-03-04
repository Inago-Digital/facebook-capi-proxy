import type { Site } from "./types"

export function isSiteActive(site: Site): boolean {
  return site.active === 1 || site.active === true
}

export function formatDate(value?: string | null): string {
  if (!value) return "-"

  try {
    const date = new Date(value)
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    )
  } catch {
    return value
  }
}

export function stripProtocol(value: string): string {
  return value.replace("https://", "").replace("http://", "")
}
