import type { ReactNode } from "react"

const PALETTE = [
  "bg-primary/10 text-primary",
  "bg-amber-500/15 text-amber-700",
  "bg-emerald-500/10 text-emerald-700",
  "bg-sky-500/10 text-sky-700",
  "bg-violet-500/10 text-violet-700",
]

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials =
    name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "?"
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${dim} ${PALETTE[hue]}`}>
      {initials}
    </span>
  )
}

export function ProgressBar({ value, className = "w-full" }: { value: number; className?: string }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${v >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${v}%` }} />
    </div>
  )
}

export function IconRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>
}