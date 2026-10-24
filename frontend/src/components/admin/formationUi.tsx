import type { ReactNode } from "react"
import { Svg } from "./ui"
import { ICON } from "./formationIcons"


export const heroBtn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-ink shadow-sm transition hover:bg-accent-dark active:scale-95 disabled:opacity-50"
export const heroBtnGhost =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"

const PALETTE = [
  "bg-primary/10 text-primary",
  "bg-amber-500/15 text-amber-700",
  "bg-emerald-500/10 text-emerald-700",
  "bg-sky-500/10 text-sky-700",
  "bg-violet-500/10 text-violet-700",
]

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "?"
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length
  const dim = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"
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
      <div className={`h-full rounded-full transition-all duration-500 ${v >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Ring({ value, size = 128 }: { value: number; size?: number }) {
  const v = Math.min(100, Math.max(0, value))
  const c = 2 * Math.PI * 52
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${v} %`}>
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-line)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r="52" fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
      <text x="60" y="67" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--color-ink)">{v}%</text>
    </svg>
  )
}

export function Hero({
  title, count, subtitle, actions, children,
}: { title: string; count?: number; subtitle?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header
      className="relative mb-6 overflow-hidden rounded-card p-5 text-white shadow-card-lg sm:p-7"
      style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-28 h-44 w-44 rounded-full bg-accent/20" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {title}
            {count !== undefined && (
              <span className="ml-3 rounded-full bg-white/15 px-3 py-0.5 align-middle text-sm font-semibold">{count}</span>
            )}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/80">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </header>
  )
}

export function Panel({
  title, subtitle, action, icon, children, className = "",
}: { title: string; subtitle?: string; action?: ReactNode; icon?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Svg d={icon} className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{title}</h3>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="min-w-0 max-w-full">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function EmptyBlock({ icon = ICON.inbox, text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-page/60 px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-line/60 text-muted">
        <Svg d={icon} className="h-6 w-6" />
      </span>
      <p className="text-sm text-muted">{text}</p>
    </div>
  )
}

export function SearchBox({
  value, onChange, placeholder, tour,
}: { value: string; onChange: (v: string) => void; placeholder: string; tour?: string }) {
  return (
    <div className="relative w-full lg:max-w-sm">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Svg d={ICON.search} className="h-4 w-4" />
      </span>
      <input
        type="search" data-tour={tour} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="min-h-[44px] w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  )
}

export function Segmented<T extends string>({
  items, value, onChange, tour,
}: { items: { id: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void; tour?: string }) {
  return (
    <div
      role="group" data-tour={tour}
      className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((i) => (
        <button
          key={i.id || "all"} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            value === i.id ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"
          }`}
        >
          {i.label}
          {i.badge !== undefined && i.badge > 0 && (
            <span className={`rounded-full px-1.5 text-xs font-bold ${value === i.id ? "bg-white/25 text-white" : "bg-accent/25 text-amber-700"}`}>{i.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}
