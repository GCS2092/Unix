import type { MouseEvent, ReactNode } from "react"
import { Award, Ellipsis, Lock, type LucideIcon } from "lucide-react"

/** Boutons de la page Certificats (design "cartes par élève"). */
export const btn =
  "inline-flex min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
export const btnPrimary =
  "inline-flex min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent bg-primary px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
export const menuItem =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-black/5 disabled:opacity-50"

/** Ferme le menu <details> quand on clique sur une de ses entrées. */
export function closeMenu(e: MouseEvent<HTMLElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open")
}

export function fmtDate(d: string | null | undefined, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-"
}

export function stamp(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function Medal({ on, locked }: { on?: boolean; locked?: boolean }) {
  const Icon = locked ? Lock : Award
  return (
    <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${on ? "bg-success/15 text-success" : "bg-black/5 text-muted"}`}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  )
}

export function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
      {children}
    </span>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </span>
      <span className="text-xs text-muted">{value} %</span>
    </span>
  )
}

export function Tile({ active, count, label, dot, onClick, tabId }: { active: boolean; count: number; label: string; dot: string; onClick: () => void; tabId: string }) {
  return (
    <button
      type="button" role="tab" aria-selected={active} data-tab={tabId} onClick={onClick}
      className={`rounded-xl border px-3.5 py-3 text-left transition ${active ? "border-primary/50 bg-primary/5" : "border-line bg-surface hover:border-primary/40"}`}
    >
      <span className="block text-[22px] font-semibold leading-tight">{count}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
    </button>
  )
}

export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="relative">
      <summary aria-label={label} title={label} className={`${btn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-card-lg">{children}</div>
    </details>
  )
}