import { useState } from "react"
import type { CategoryInfo } from "../api/catalog"

export interface ShopFilters { category: string; stock: boolean; fresh: boolean; min: string; max: string }

const input =
  "min-h-[48px] w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const { checked, onChange, label, hint } = props
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-xl border border-line px-4 py-2 text-left transition hover:border-primary/40"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

/** Monte uniquement quand il est ouvert : l'etat du brouillon repart donc de la valeur courante a chaque ouverture. */
export default function ShopFilterSheet(props: {
  initial: ShopFilters
  categories: CategoryInfo[]
  fr: boolean
  onApply: (f: ShopFilters) => void
  onClose: () => void
}) {
  const { initial, categories, fr, onApply, onClose } = props
  const [d, setD] = useState<ShopFilters>(initial)
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9)
  const bad = d.min !== "" && d.max !== "" && Number(d.min) > Number(d.max)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog" aria-modal="true" aria-label={fr ? "Filtres" : "Filters"}
      onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-surface shadow-card-lg sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold">{fr ? "Filtres" : "Filters"}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label={fr ? "Fermer" : "Close"} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-page hover:text-ink">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-bold">{fr ? "Disponibilité" : "Availability"}</h3>
            <Switch checked={d.stock} onChange={(v) => setD((s) => ({ ...s, stock: v }))} label={fr ? "En stock uniquement" : "In stock only"} />
            <Switch checked={d.fresh} onChange={(v) => setD((s) => ({ ...s, fresh: v }))} label={fr ? "Nouveautés" : "New arrivals"} hint={fr ? "Ajoutés ces 14 derniers jours" : "Added in the last 14 days"} />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold">{fr ? "Prix (FCFA)" : "Price (FCFA)"}</h3>
            <div className="flex items-center gap-2">
              <input
                type="text" inputMode="numeric" value={d.min} onChange={(e) => setD((s) => ({ ...s, min: digits(e.target.value) }))}
                placeholder={fr ? "Minimum" : "Minimum"} aria-label={fr ? "Prix minimum" : "Minimum price"} aria-invalid={bad || undefined} className={input}
              />
              <span className="text-muted" aria-hidden="true">&ndash;</span>
              <input
                type="text" inputMode="numeric" value={d.max} onChange={(e) => setD((s) => ({ ...s, max: digits(e.target.value) }))}
                placeholder={fr ? "Maximum" : "Maximum"} aria-label={fr ? "Prix maximum" : "Maximum price"} aria-invalid={bad || undefined} className={input}
              />
            </div>
            {bad && <p role="alert" className="mt-1.5 text-xs text-danger">{fr ? "Le minimum dépasse le maximum." : "Minimum is higher than maximum."}</p>}
          </section>

          {categories.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold">{fr ? "Catégorie" : "Category"}</h3>
              <div role="radiogroup" className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {[{ id: 0, slug: "", name: fr ? "Toutes les catégories" : "All categories", products_count: -1 }, ...categories].map((c) => {
                  const on = d.category === c.slug
                  return (
                    <button
                      key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setD((s) => ({ ...s, category: c.slug }))}
                      className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left text-sm transition ${on ? "bg-primary/10 font-semibold text-primary" : "hover:bg-page"} ${c.products_count === 0 ? "opacity-50" : ""}`}
                    >
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-primary" : "border-line"}`}>
                          {on && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </span>
                        {c.name}
                      </span>
                      {c.products_count >= 0 && <span className="text-xs text-muted">{c.products_count}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button" onClick={() => setD({ category: "", stock: false, fresh: false, min: "", max: "" })}
            className="min-h-[48px] rounded-lg border border-line px-4 text-sm font-semibold transition hover:bg-page active:scale-95"
          >
            {fr ? "Réinitialiser" : "Reset"}
          </button>
          <button
            type="button" disabled={bad} onClick={() => onApply(d)}
            className="min-h-[48px] flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
          >
            {fr ? "Appliquer les filtres" : "Apply filters"}
          </button>
        </div>
      </div>
    </div>
  )
}