import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"

export function Svg({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export type Tone = "neutral" | "success" | "warn" | "danger" | "info"

const PILL: Record<Tone, string> = {
  neutral: "bg-line/60 text-muted",
  success: "bg-success/10 text-emerald-700",
  warn: "bg-accent/15 text-amber-700",
  danger: "bg-danger/10 text-danger",
  info: "bg-sky-500/10 text-sky-700",
}

const DOT: Record<Tone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-danger",
  info: "bg-sky-500",
}

export function Pill({ tone = "neutral", dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  )
}

export function PageHeader({ title, count, subtitle, actions }: { title: string; count?: number; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {title}
          {count !== undefined && (
            <span className="ml-2 rounded-full bg-line/70 px-2.5 py-0.5 align-middle text-sm font-semibold text-muted">{count}</span>
          )}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const STAT_TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-500/10 text-emerald-700",
  warn: "bg-amber-500/10 text-amber-700",
  danger: "bg-danger/10 text-danger",
  info: "bg-sky-500/10 text-sky-700",
}

export function StatCard({
  label, value, hint, icon, tone = "neutral", active = false, onClick,
}: {
  label: string
  value: string | number
  hint?: string
  icon: string
  tone?: Tone
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${STAT_TONE[tone]}`}>
        <Svg d={icon} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-medium text-muted">{label}</span>
        <span className="block truncate text-xl font-extrabold leading-tight sm:text-2xl">{value}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </>
  )
  const cls = `flex items-center gap-3 rounded-card border bg-surface p-3.5 shadow-card transition sm:p-4 ${
    active ? "border-primary ring-2 ring-primary/20" : "border-line"
  }`
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} w-full hover:border-primary/50 hover:shadow-card-lg active:scale-[0.99]`}>
      {body}
    </button>
  )
}

export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? "bg-primary" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  )
}

const ICON_BTN =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary/40 hover:text-ink active:scale-95 disabled:opacity-50 sm:h-9 sm:w-9"

export function IconButton({
  label, onClick, to, danger = false, disabled = false, children, dataTour,
}: {
  label: string
  onClick?: () => void
  to?: string
  danger?: boolean
  disabled?: boolean
  children: ReactNode
  dataTour?: string
}) {
  const cls = `${ICON_BTN} ${danger ? "hover:!border-danger/40 hover:!bg-danger/5 hover:!text-danger" : ""}`
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} data-tour={dataTour} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} title={label} data-tour={dataTour} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

function ThumbInner({ src, className }: { src?: string | null; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-line bg-page text-muted`}>
        <Svg d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9.5h.01" className="h-5 w-5" />
      </div>
    )
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} shrink-0 rounded-lg border border-line object-cover`} />
}

export function Thumb({ src, className = "h-12 w-12" }: { src?: string | null; className?: string }) {
  return <ThumbInner key={src ?? ""} src={src} className={className} />
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-[0.97] ${
        active ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({
  items, value, onChange, tour,
}: {
  items: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  tour?: string
}) {
  return (
    <div role="tablist" data-tour={tour} className="mb-4 flex gap-1 border-b border-line">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          role="tab"
          aria-selected={value === i.id}
          onClick={() => onChange(i.id)}
          className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm font-semibold transition ${
            value === i.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {i.label}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

export function Drawer({
  open, title, subtitle, onClose, footer, children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <aside role="dialog" aria-modal="true" aria-label={title} className="animate-slide-in relative flex h-full w-full max-w-2xl flex-col bg-page shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-page hover:text-ink">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <div className="border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </aside>
    </div>
  )
}