import { useState } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"

type Range = "7d" | "30d" | "90d" | "12m" | "all"
type Counts = Record<string, number>

interface Overview {
  range: Range
  orders: {
    total: number
    status: Counts
    delivery_method: Counts
    delivery_zone: Counts
    fulfillment: Counts
    paid_with_conflict: number
    accounts: number
    guests: number
  }
  revenue: { total: number; by_product: { name: string; revenue: number }[]; others: number }
  stock: {
    threshold: number
    out: number
    low: number
    ok: number
    published: number
    hidden: number
    units_available: number
    units_reserved: number
  }
  invoices: { issued: number; cancelled: number }
  users: { total: number; blocked: number }
  previous: { orders: number; paid: number; revenue: number } | null
  generated_at: string
}

interface Slice { label: string; value: number; color: string }

const GREEN = "#10b981", AMBER = "#f59e0b", RED = "#ef4444", BLUE = "#3b82f6"
const VIOLET = "#8b5cf6", SLATE = "#94a3b8", TEAL = "#0f766e", PINK = "#ec4899"
const PALETTE = [TEAL, BLUE, AMBER, VIOLET, PINK]

const RANGES: [Range, string][] = [["7d", "7 jours"], ["30d", "30 jours"], ["90d", "90 jours"], ["12m", "12 mois"], ["all", "Tout"]]

const STATUS: Record<string, [string, string]> = {
  paid: ["Payées", GREEN], pending: ["En attente", AMBER], failed: ["Échouées", RED], cancelled: ["Annulées", SLATE],
}
const METHOD: Record<string, [string, string]> = {
  delivery: ["Livraison à domicile", BLUE], pickup: ["Retrait sur place", VIOLET], none: ["Numérique / autre", SLATE],
}
const ZONE: Record<string, [string, string]> = {
  dakar: ["Dakar", TEAL], regions: ["Régions", AMBER], none: ["Autre", SLATE],
}
const FULFILL: Record<string, [string, string]> = {
  received: ["Reçues", SLATE], preparing: ["En préparation", AMBER], shipped: ["Expédiées", BLUE],
  ready: ["Prêtes à retirer", VIOLET], delivered: ["Livrées", GREEN], picked_up: ["Retirées", TEAL], none: ["Sans suivi", "#cbd5e1"],
}

function fromCounts(c: Counts, defs: Record<string, [string, string]>): Slice[] {
  const keys = Object.keys(defs)
  const out: Slice[] = keys.map((k) => ({ label: defs[k][0], color: defs[k][1], value: c[k] ?? 0 }))
  const other = Object.entries(c).reduce((a, [k, v]) => (keys.includes(k) ? a : a + v), 0)
  if (other > 0) out.push({ label: "Autres", color: "#e2e8f0", value: other })
  return out
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

const variation = (cur: number, prev?: number | null): number | null =>
  prev == null ? null : prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 1000) / 10

function Donut({ title, note, slices, center, centerLabel, to, toLabel }: {
  title: string; note?: string; slices: Slice[]; center: string; centerLabel: string; to?: string; toLabel?: string
}) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const arcs: { color: string; len: number; offset: number; label: string }[] = []
  let acc = 0
  for (const s of slices) {
    if (s.value <= 0) continue
    const len = (s.value / total) * 100
    arcs.push({ color: s.color, len, offset: 25 - acc, label: `${s.label} : ${s.value}` })
    acc += len
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
        <svg viewBox="0 0 42 42" className="h-36 w-36 shrink-0" role="img" aria-label={`${title} : ${center} ${centerLabel}`}>
          <circle cx="21" cy="21" r="15.91549431" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          {arcs.map((a) => (
            <circle key={a.label} cx="21" cy="21" r="15.91549431" fill="none" stroke={a.color} strokeWidth="6"
              strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={a.offset}>
              <title>{a.label}</title>
            </circle>
          ))}
          <text x="21" y="22" textAnchor="middle" fontSize="6" fontWeight="800" fill="currentColor">{total > 0 ? center : "—"}</text>
          <text x="21" y="27.5" textAnchor="middle" fontSize="2.8" fill="#64748b">{centerLabel}</text>
        </svg>
        <ul className="w-full space-y-1.5 text-sm">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="whitespace-nowrap text-muted">
                <span className="font-semibold text-ink">{s.value}</span> · {pct(s.value, total)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      {to && <Link to={to} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">{toLabel ?? "Voir le détail"}</Link>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="flex items-center justify-between gap-2 text-xs text-muted"><span>{label}</span>{delta != null && <span className="shrink-0 font-semibold" style={{ color: delta > 0 ? GREEN : delta < 0 ? RED : SLATE }} title="Par rapport à la période précédente">{delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)}%</span>}</p>
      <p className="mt-1 break-words text-lg font-extrabold sm:text-2xl">{value}</p>
    </div>
  )
}

export default function AdminOverviewPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [range, setRange] = useState<Range>("30d")

  const q = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: async () => (await apiClient.get<{ data: Overview }>("/admin/overview", { params: { range } })).data.data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const d = q.data
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n)
  const exportCsv = () => {
    if (!d) return
    const rows: (string | number)[][] = [["Section", "Indicateur", "Valeur"]]
    const add = (section: string, label: string, value: string | number) => rows.push([section, label, value])
    const addCounts = (section: string, c: Counts, defs: Record<string, [string, string]>) =>
      fromCounts(c, defs).forEach((x) => add(section, x.label, x.value))
    add("Général", "Période", RANGES.find(([id]) => id === range)?.[1] ?? range)
    add("Général", "Exporté le", new Date().toLocaleString(locale))
    add("Général", "Commandes", d.orders.total)
    add("Général", "Chiffre d'affaires encaissé (FCFA)", d.revenue.total)
    add("Général", "Taux de paiement (%)", pct(d.orders.status.paid ?? 0, d.orders.total))
    if (d.previous) {
      add("Période précédente", "Commandes", d.previous.orders)
      add("Période précédente", "Chiffre d'affaires encaissé (FCFA)", d.previous.revenue)
    }
    addCounts("Statut des commandes", d.orders.status, STATUS)
    addCounts("Mode de livraison", d.orders.delivery_method, METHOD)
    addCounts("Zone de livraison", d.orders.delivery_zone, ZONE)
    addCounts("Avancement des commandes payées", d.orders.fulfillment, FULFILL)
    add("Conflits de stock", "Commandes payées en conflit", d.orders.paid_with_conflict)
    add("Origine des commandes", "Avec compte", d.orders.accounts)
    add("Origine des commandes", "Invités", d.orders.guests)
    d.revenue.by_product.forEach((p) => add("CA par produit (FCFA)", p.name, p.revenue))
    if (d.revenue.others > 0) add("CA par produit (FCFA)", "Autres produits", d.revenue.others)
    add("Stock (état actuel)", "En stock", d.stock.ok)
    add("Stock (état actuel)", "Stock bas", d.stock.low)
    add("Stock (état actuel)", "Épuisés", d.stock.out)
    add("Stock (état actuel)", "Produits visibles", d.stock.published)
    add("Stock (état actuel)", "Produits masqués", d.stock.hidden)
    add("Stock (état actuel)", "Unités disponibles", d.stock.units_available)
    add("Stock (état actuel)", "Unités réservées", d.stock.units_reserved)
    add("Factures", "Émises", d.invoices.issued)
    add("Factures", "Annulées", d.invoices.cancelled)
    add("Comptes (état actuel)", "Total", d.users.total)
    add("Comptes (état actuel)", "Bloqués", d.users.blocked)

    const esc = (v: string | number) => {
      const s = String(v)
      const safe = typeof v === "string" && /^[=+\-@]/.test(s) ? "'" + s : s
      return `"${safe.replace(/"/g, '""')}"`
    }
    const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `apercu-boutique-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportPdf = () => window.print()
  const compact = (n: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Aperçu de la boutique</h1>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="group" aria-label="Période">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                range === id ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <style>{`@page { size: A4; margin: 12mm } @media print { aside, nav, header { display: none !important } .rounded-card { break-inside: avoid } * { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-muted" aria-live="polite">
          {d ? `Mis à jour à ${new Date(d.generated_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}
          {q.isFetching && " · actualisation…"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void q.refetch()} disabled={q.isFetching}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50">
            Actualiser
          </button>
          <button type="button" onClick={exportCsv} disabled={!d}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50">
            Exporter en CSV
          </button>
          <button type="button" onClick={exportPdf} disabled={!d}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50">
            Exporter en PDF
          </button>
        </div>
      </div>
      <p className="mb-4 hidden text-sm print:block">
        Période : {RANGES.find(([id]) => id === range)?.[1]} · Édité le {new Date().toLocaleString(locale)}
      </p>

      {q.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
      {q.error && (
        <p role="alert" className="py-4 text-danger">
          Impossible de charger l'aperçu.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void q.refetch()}>Réessayer</button>
        </p>
      )}

      {d && (() => {
        const st = d.orders.status
        const paid = st.paid ?? 0
        const notPaid = d.orders.total - paid
        const fulfillPaid = Object.values(d.orders.fulfillment).reduce((a, v) => a + v, 0)
        const done = (d.orders.fulfillment.delivered ?? 0) + (d.orders.fulfillment.picked_up ?? 0)
        const products: Slice[] = d.revenue.by_product.map((p, i) => ({ label: p.name, value: p.revenue, color: PALETTE[i % PALETTE.length] }))
        if (d.revenue.others > 0) products.push({ label: "Autres produits", value: d.revenue.others, color: SLATE })
        const s = d.stock
        const totalProducts = s.out + s.low + s.ok
        const units = s.units_available + s.units_reserved
        const invTotal = d.invoices.issued + d.invoices.cancelled

        return (
          <>
            {(() => {
              const todo = [
                { n: d.orders.paid_with_conflict, label: "commande(s) payée(s) en conflit de stock", to: "/admin/commandes?quick=stock_conflict" },
                { n: s.out, label: "produit(s) épuisé(s)", to: "/admin/stock" },
                { n: s.low, label: "produit(s) en stock bas", to: "/admin/stock" },
                { n: st.pending ?? 0, label: "commande(s) en attente de paiement", to: "/admin/commandes" },
              ].filter((x) => x.n > 0)
              return (
                <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card" style={{ borderLeft: `4px solid ${todo.length ? AMBER : GREEN}` }}>
                  <h2 className="mb-1 font-semibold">À traiter</h2>
                  {todo.length === 0 ? (
                    <p className="text-sm text-muted">Rien à traiter pour le moment.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      {todo.map((x) => (
                        <li key={x.label}>
                          <Link to={x.to} className="font-semibold text-primary hover:underline">{x.n}</Link> {x.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Commandes" value={String(d.orders.total)} delta={variation(d.orders.total, d.previous?.orders)} />
              <Kpi label="Chiffre d'affaires encaissé" value={money(d.revenue.total)} delta={variation(d.revenue.total, d.previous?.revenue)} />
              <Kpi label="Taux de paiement" value={`${pct(paid, d.orders.total)} %`} />
              <Kpi label="Panier moyen" value={paid > 0 ? money(Math.round(d.revenue.total / paid)) : "—"} delta={paid > 0 && d.previous && d.previous.paid > 0 ? variation(d.revenue.total / paid, d.previous.revenue / d.previous.paid) : null} />
            </div>

            <Section title="Commandes (période choisie)">
              <Donut title="Statut des commandes" slices={fromCounts(st, STATUS)} center={String(d.orders.total)} centerLabel="commandes" to="/admin/commandes" toLabel="Voir les commandes" />
              <Donut title="Taux de paiement" note="Commandes payées parmi toutes les commandes créées"
                slices={[{ label: "Payées", value: paid, color: GREEN }, { label: "Non abouties", value: notPaid, color: RED }]}
                center={`${pct(paid, d.orders.total)}%`} centerLabel="payées" />
              <Donut title="Mode de livraison" slices={fromCounts(d.orders.delivery_method, METHOD)} center={String(d.orders.total)} centerLabel="commandes" />
              <Donut title="Zone de livraison" note="Commandes en livraison à domicile" slices={fromCounts(d.orders.delivery_zone, ZONE)}
                center={String(Object.values(d.orders.delivery_zone).reduce((a, v) => a + v, 0))} centerLabel="livraisons" />
              <Donut title="Avancement des commandes payées" slices={fromCounts(d.orders.fulfillment, FULFILL)}
                center={`${pct(done, fulfillPaid)}%`} centerLabel="terminées" />
              <Donut title="Conflits de stock" note="Commandes payées sans stock disponible au paiement"
                slices={[{ label: "Avec conflit", value: d.orders.paid_with_conflict, color: RED }, { label: "Sans conflit", value: Math.max(0, paid - d.orders.paid_with_conflict), color: GREEN }]}
                center={`${pct(d.orders.paid_with_conflict, paid)}%`} centerLabel="en conflit"
                to="/admin/commandes?quick=stock_conflict" toLabel="Traiter les conflits" />
            </Section>

            <Section title="Ventes (période choisie)">
              <Donut title="Chiffre d'affaires par produit" note="Top 5 des produits sur les commandes payées" slices={products}
                center={compact(d.revenue.total)} centerLabel="FCFA" />
              <Donut title="Comptes et invités" note="Origine des commandes"
                slices={[{ label: "Clients avec compte", value: d.orders.accounts, color: TEAL }, { label: "Invités", value: d.orders.guests, color: AMBER }]}
                center={`${pct(d.orders.accounts, d.orders.total)}%`} centerLabel="avec compte" />
            </Section>

            <Section title="Catalogue et stock (état actuel)">
              <Donut title="Santé du stock" note={`Stock bas : ${s.threshold} unités ou moins`}
                slices={[{ label: "En stock", value: s.ok, color: GREEN }, { label: "Stock bas", value: s.low, color: AMBER }, { label: "Épuisés", value: s.out, color: RED }]}
                center={`${pct(s.ok, totalProducts)}%`} centerLabel="en stock" to="/admin/stock" toLabel="Gérer le stock" />
              <Donut title="Publication des produits"
                slices={[{ label: "Visibles", value: s.published, color: BLUE }, { label: "Masqués", value: s.hidden, color: SLATE }]}
                center={`${pct(s.published, s.published + s.hidden)}%`} centerLabel="visibles" />
              <Donut title="Unités en stock" note="Réservées = commandes en attente de paiement"
                slices={[{ label: "Disponibles", value: s.units_available, color: TEAL }, { label: "Réservées", value: s.units_reserved, color: AMBER }]}
                center={`${pct(s.units_reserved, units)}%`} centerLabel="réservées" />
            </Section>

            <Section title="Factures et comptes">
              <Donut title="Factures (période choisie)"
                slices={[{ label: "Émises", value: d.invoices.issued, color: GREEN }, { label: "Annulées", value: d.invoices.cancelled, color: RED }]}
                center={`${pct(d.invoices.issued, invTotal)}%`} centerLabel="valides" to="/admin/factures" toLabel="Voir les factures" />
              <Donut title="Comptes utilisateurs (état actuel)"
                slices={[{ label: "Actifs", value: Math.max(0, d.users.total - d.users.blocked), color: BLUE }, { label: "Bloqués", value: d.users.blocked, color: RED }]}
                center={`${pct(d.users.total - d.users.blocked, d.users.total)}%`} centerLabel="actifs" />
            </Section>
          </>
        )
      })()}
    </div>
  )
}