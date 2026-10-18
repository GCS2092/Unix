import type { ReactNode } from "react"

export function PageHeader({ title, count, subtitle, action }: { title: string; count?: number; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {title}
          {count !== undefined && <span className="ml-2 rounded-full bg-line/70 px-2.5 py-0.5 align-middle text-xs font-semibold text-muted">{count}</span>}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const TONES = {
  success: "bg-success/10 text-success",
  primary: "bg-primary/10 text-primary",
  muted: "bg-line/70 text-muted",
  warning: "bg-accent/20 text-ink",
  danger: "bg-danger/10 text-danger",
} as const

export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}

export const field =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
export const panel = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
