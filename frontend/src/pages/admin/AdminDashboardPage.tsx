import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import type { DashboardMetric, DashboardParams, DashboardRange } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { saveBlob } from "../../lib/download"
import { statusBadgeClass } from "../../lib/orderStatus"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"

/* ---------- Petits composants ---------- */

function Delta({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-muted">Nouveau</span>
  if (change === 0) return <span className="text-xs text-muted">Stable</span>
  const up = change > 0
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(change)} %
    </span>
  )
}

function Kpi({
  label, value, metric, to, tone = "", hint,
}: {
  label: string
  value: string | number
  metric?: DashboardMetric
  to?: string
  tone?: string
  hint?: string
}) {
  const body = (
    <div className="h-full rounded-card border border-line bg-surface p-4 shadow-card transition hover:shadow-card-lg">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
      <div className="mt-1 min-h-4">
        {metric ? <Delta change={metric.change} /> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>
}

interface RankItem { key: string | number; label: string; sub?: string; value: number; display: string }

function RankList({ items, empty }: { items: RankItem[]; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3 text-sm">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{i.label}</span>
            <span className="whitespace-nowrap text-muted">{i.display}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(3, (i.value / max) * 100)}%` }} />
          </div>
          {i.sub && <p className="mt-0.5 truncate text-xs text-muted">{i.sub}</p>}
        </li>
      ))}
    </ul>
  )
}

function SalesChart({
  series, granularity, metric, locale, format,
}: {
  series: { date: string; revenue: number; orders: number }[]
  granularity: "day" | "month"
  metric: "revenue" | "orders"
  locale: string
  format: (n: number) => string
}) {
  const max = Math.max(1, ...series.map((s) => s[metric]))
  const label = (d: string) =>
    granularity === "month"
      ? new Date(`${d}-01`).toLocaleDateString(locale, { month: "short", year: "2-digit" })
      : new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short" })
  const mid = series[Math.floor(series.length / 2)]
  const hasData = series.some((s) => s[metric] > 0)

  return (
    <div>
      <div className="flex items-start gap-2">
        <span className="w-14 shrink-0 text-right text-[11px] text-muted">{format(max)}</span>
        <div className={`flex h-44 flex-1 items-end border-b border-l border-line ${series.length > 31 ? "gap-px" : "gap-1.5"}`}>
          {series.map((s) => (
            <div
              key={s.date}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${label(s.date)} : ${metric === "revenue" ? formatPrice(s.revenue) : s.orders} · ${s.orders} cmd`}
            >
              <div
                className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                style={{ height: `${s[metric] > 0 ? Math.max(3, (s[metric] / max) * 100) : 0}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-16 text-xs text-muted">
        <span>{label(series[0].date)}</span>
        {series.length > 6 && <span>{label(mid.date)}</span>}
        <span>{label(series[series.length - 1].date)}</span>
      </div>
      {!hasData && <p className="mt-3 text-center text-sm text-muted">Aucune vente sur cette période.</p>}
    </div>
  )
}

const STATUS_BAR: Record<string, string> = {
  paid: "bg-emerald-500",
  pending: "bg-amber-400",
  failed: "bg-danger",
  cancelled: "bg-slate-400",
}

const RANGES: { id: DashboardRange; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "12m", label: "12 mois" },
  { id: "custom", label: "Personnalisé" },
]

const DELIVERY_LABEL: Record<string, string> = {
  delivery: "Livraison",
  pickup: "Retrait en boutique",
  none: "Sans livraison (cours)",
}

const FULFILLMENT_LABEL: Record<string, string> = {
  received: "Reçue",
  preparing: "En préparation",
  shipped: "Expédiée",
  ready: "Prête",
  delivered: "Livrée",
}

/* ---------- Page ---------- */

export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"

  const [range, setRange] = useState<DashboardRange>("30d")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders">("revenue")

  const params: DashboardParams =
    range === "custom"
      ? from && to ? { range, from, to } : { range: "30d" }
      : { range }

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-dashboard", params.range, params.from, params.to],
    queryFn: async () => (await adminApi.dashboard(params)).data.data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) {
    return (
      <div role="status" className="space-y-4">
        <Skeleton className="h-10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const m = data.metrics
  const s = data.snapshot
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })
  const statusTotal = data.statuses.reduce((n, x) => n + x.count, 0)
  const typeTotal = data.sales_by_type.reduce((n, x) => n + x.revenue, 0)
  const productRev = data.sales_by_type.find((x) => x.type === "product")?.revenue ?? 0
  const courseRev = data.sales_by_type.find((x) => x.type === "course")?.revenue ?? 0

  function exportSeries() {
    const rows = [
      ["Date", "Chiffre d'affaires", "Commandes payées"],
      ...data!.series.map((p) => [p.date, String(p.revenue), String(p.orders)]),
    ]
    const csv = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n")
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `statistiques-${data!.period.from}_${data!.period.to}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Filtre de période */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("admin.period", { defaultValue: "Période" })}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                range === r.id ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {t(`admin.range_${r.id}`, { defaultValue: r.label })}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Du"
              className="rounded-lg border border-line bg-surface px-2 py-1.5" />
            <span className="text-muted">au</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Au"
              className="rounded-lg border border-line bg-surface px-2 py-1.5" />
          </div>
        )}

        <p className="text-xs text-muted sm:ml-auto">
          {fmtDate(data.period.from)} – {fmtDate(data.period.to)} · comparé à {fmtDate(data.period.previous_from)} – {fmtDate(data.period.previous_to)}
          {isFetching && " · mise à jour…"}
        </p>
      </div>

      <div className={`space-y-6 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {/* Indicateurs de la période */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t("admin.kpi_revenue", { defaultValue: "Chiffre d'affaires" })} value={formatPrice(m.revenue.value)} metric={m.revenue} tone="text-primary" />
          <Kpi label={t("admin.kpi_paid_orders", { defaultValue: "Commandes payées" })} value={m.paid_orders.value} metric={m.paid_orders} />
          <Kpi label={t("admin.kpi_avg_basket", { defaultValue: "Panier moyen" })} value={formatPrice(m.avg_basket.value)} metric={m.avg_basket} />
          <Kpi label={t("admin.kpi_payment_rate", { defaultValue: "Taux de paiement" })} value={`${m.payment_rate.value} %`} metric={m.payment_rate}
            tone={m.orders_created.value > 0 && m.payment_rate.value < 50 ? "text-danger" : ""} />
          <Kpi label={t("admin.kpi_orders_created", { defaultValue: "Commandes créées" })} value={m.orders_created.value} metric={m.orders_created} />
          <Kpi label={t("admin.kpi_new_customers", { defaultValue: "Nouveaux clients" })} value={m.new_customers.value} metric={m.new_customers} />
          <Kpi label={t("admin.kpi_new_enrollments", { defaultValue: "Nouvelles inscriptions" })} value={m.new_enrollments.value} metric={m.new_enrollments} />
          <Kpi label={t("admin.kpi_revenue_total", { defaultValue: "CA total (depuis le début)" })} value={formatPrice(s.revenue_total)} hint="Toutes périodes" />
        </div>

        {/* À faire maintenant (indépendant de la période) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t("admin.kpi_to_process", { defaultValue: "À traiter" })} value={s.orders_to_process} to="/admin/commandes?quick=to_process"
            tone={s.orders_to_process > 0 ? "text-accent" : ""} hint="Payées, livraison non terminée" />
          <Kpi label={t("admin.kpi_pending", { defaultValue: "En attente de paiement" })} value={s.orders_pending} to="/admin/commandes?status=pending" />
          <Kpi label={t("admin.kpi_failed", { defaultValue: "Paiements échoués" })} value={s.orders_failed} to="/admin/commandes?status=failed"
            tone={s.orders_failed > 0 ? "text-danger" : ""} />
          <Kpi label={t("admin.kpi_low_stock", { defaultValue: "Produits en stock faible" })} value={s.low_stock_count} to="/admin/produits"
            tone={s.low_stock_count > 0 ? "text-accent" : ""} hint={`${s.products_total} produits au total`} />
        </div>

        {/* Courbe */}
        <Card
          title={chartMetric === "revenue"
            ? t("admin.sales_chart_revenue", { defaultValue: "Chiffre d'affaires" })
            : t("admin.sales_chart_orders", { defaultValue: "Commandes payées" })}
          action={
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-line text-xs font-medium">
                {(["revenue", "orders"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setChartMetric(k)} aria-pressed={chartMetric === k}
                    className={`px-2.5 py-1 ${chartMetric === k ? "bg-primary text-white" : "bg-surface text-muted"}`}>
                    {k === "revenue" ? "CA" : "Commandes"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={exportSeries} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink">
                Exporter CSV
              </button>
            </div>
          }
        >
          <SalesChart series={data.series} granularity={data.period.granularity} metric={chartMetric} locale={locale} format={(n) => (chartMetric === "revenue" ? formatPrice(n) : String(n))} />
        </Card>

        {/* Statuts et répartition */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("admin.status_split", { defaultValue: "Commandes par statut" })}>
            {statusTotal === 0 ? (
              <Empty text="Aucune commande créée sur cette période." />
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-line">
                  {data.statuses.map((x) => (
                    <div key={x.status} className={STATUS_BAR[x.status] ?? "bg-slate-300"} style={{ width: `${(x.count / statusTotal) * 100}%` }} title={`${x.status} : ${x.count}`} />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {data.statuses.map((x) => (
                    <li key={x.status} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block size-2.5 rounded-full ${STATUS_BAR[x.status] ?? "bg-slate-300"}`} />
                        {t(`status.${x.status}`, { defaultValue: x.status })}
                      </span>
                      <span className="text-muted">{x.count} · {Math.round((x.count / statusTotal) * 100)} %</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title={t("admin.sales_split", { defaultValue: "Produits et cours" })}>
            {typeTotal === 0 ? (
              <Empty text="Aucune vente sur cette période." />
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-line">
                  <div className="bg-primary" style={{ width: `${(productRev / typeTotal) * 100}%` }} />
                  <div className="bg-accent" style={{ width: `${(courseRev / typeTotal) * 100}%` }} />
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="inline-block size-2.5 rounded-full bg-primary" />Produits</span>
                    <span className="text-muted">{formatPrice(productRev)} · {Math.round((productRev / typeTotal) * 100)} %</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="inline-block size-2.5 rounded-full bg-accent" />Cours</span>
                    <span className="text-muted">{formatPrice(courseRev)} · {Math.round((courseRev / typeTotal) * 100)} %</span>
                  </li>
                </ul>
              </>
            )}
            {data.deliveries.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-medium text-muted">Modes de livraison</p>
                <ul className="space-y-1.5 text-sm">
                  {data.deliveries.map((d) => (
                    <li key={d.method} className="flex items-center justify-between gap-3">
                      <span>{DELIVERY_LABEL[d.method] ?? d.method}</span>
                      <span className="text-muted">{d.orders} cmd · {formatPrice(d.revenue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Classements */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("admin.top_products", { defaultValue: "Produits les plus vendus" })}>
            <RankList
              empty={t("admin.no_sales", { defaultValue: "Aucune vente pour le moment." })}
              items={data.top_products.map((p) => ({ key: p.id, label: p.name, value: p.revenue, display: `× ${p.quantity} · ${formatPrice(p.revenue)}` }))}
            />
          </Card>
          <Card title={t("admin.top_courses", { defaultValue: "Cours les plus vendus" })}>
            <RankList
              empty="Aucun cours vendu sur cette période."
              items={data.top_courses.map((c) => ({ key: c.id, label: c.title, value: c.revenue, display: `× ${c.quantity} · ${formatPrice(c.revenue)}` }))}
            />
          </Card>
          <Card title={t("admin.top_customers", { defaultValue: "Meilleurs clients" })}>
            <RankList
              empty="Aucun client sur cette période."
              items={data.top_customers.map((c, i) => ({
                key: c.email ?? `c${i}`, label: c.name, sub: c.email ?? undefined, value: c.revenue,
                display: `${c.orders} cmd · ${formatPrice(c.revenue)}`,
              }))}
            />
          </Card>
          <Card title={t("admin.top_cities", { defaultValue: "Villes principales" })}>
            <RankList
              empty="Aucune livraison sur cette période."
              items={data.top_cities.map((c) => ({ key: c.city, label: c.city, value: c.revenue, display: `${c.orders} cmd · ${formatPrice(c.revenue)}` }))}
            />
          </Card>
        </div>

        {/* À traiter / à relancer / stock */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("admin.to_process", { defaultValue: "Commandes à traiter" })}
            action={<Link to="/admin/commandes?quick=to_process" className="text-sm font-semibold text-primary hover:underline">Voir tout</Link>}>
            {data.to_process.length === 0 ? (
              <Empty text="Rien à traiter pour le moment." />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {data.to_process.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">#{o.id} · {o.customer}</span>
                      <span className="block text-xs text-muted">
                        {DELIVERY_LABEL[o.delivery_method ?? "none"] ?? o.delivery_method}
                        {o.paid_at && ` · payée le ${fmtDate(o.paid_at)}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted">{formatPrice(o.total, o.currency)}</span>
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        {FULFILLMENT_LABEL[o.fulfillment_status ?? ""] ?? o.fulfillment_status ?? "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("admin.failed_orders", { defaultValue: "Paiements échoués à relancer" })}>
            {data.failed_orders.length === 0 ? (
              <Empty text="Aucun paiement échoué." />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {data.failed_orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">#{o.id} · {o.customer}</span>
                      <span className="block text-xs text-muted">{fmtDate(o.created_at)}</span>
                    </span>
                    <span className="text-danger">{formatPrice(o.total, o.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("admin.low_stock", { defaultValue: "Stock faible" })}>
            {data.low_stock.length === 0 ? (
              <Empty text={t("admin.stock_ok", { defaultValue: "Aucun produit en stock faible." })} />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {data.low_stock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? "bg-danger/10 text-danger" : "bg-accent/15 text-accent"}`}>
                      {p.stock === 0 ? "Rupture" : p.stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("admin.activity_summary", { defaultValue: "Vue d'ensemble" })}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">Clients inscrits</dt><dd className="text-lg font-bold">{s.users_total}</dd></div>
              <div><dt className="text-muted">Produits</dt><dd className="text-lg font-bold">{s.products_total}</dd></div>
              <div><dt className="text-muted">Cours</dt><dd className="text-lg font-bold">{s.courses_total}</dd></div>
              <div><dt className="text-muted">Inscriptions</dt><dd className="text-lg font-bold">{s.enrollments_total}</dd></div>
            </dl>
          </Card>
        </div>

        {/* Dernières commandes */}
        <Card title={t("admin.recent_orders", { defaultValue: "Dernières commandes" })}>
          {data.recent_orders.length === 0 ? (
            <Empty text="Aucune commande pour le moment." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.recent_orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">#{o.id} · {o.customer}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted">{formatPrice(o.total, o.currency)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(o.status)}`}>
                      {t(`status.${o.status}`, { defaultValue: o.status })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/commandes" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            {t("admin.see_all", { defaultValue: "Voir tout" })}
          </Link>
        </Card>
      </div>
    </div>
  )
}