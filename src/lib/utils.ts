import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatElapsed(ms: number | null, status: string): string {
  if (ms === null || status === "pending" || status === "running") return "—"
  if (ms < 1) return "<1 ms"
  return `${Math.round(ms)} ms`
}

export async function copyText(text: string): Promise<void> {
  window.focus()
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (error) {
      console.error("Clipboard API failed", error)
    }
  }

  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.top = "0"
  area.style.left = "0"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.focus()
  area.select()
  area.setSelectionRange(0, area.value.length)
  const copied = document.execCommand("copy")
  area.remove()
  if (!copied) {
    throw new Error("Could not copy to the clipboard")
  }
}
