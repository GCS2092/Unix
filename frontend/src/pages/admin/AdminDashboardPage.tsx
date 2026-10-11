import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import type { DashboardMetric, DashboardParams, DashboardRange } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { saveBlob } from "../../lib/download"
import { statusBadgeClass } from "../../lib/orderStatus"
import { ErrorState } from "../../components/States"
import { DashboardSkeleton } from "../../components/Skeleton"

/* ---------- Petits composants ---------- */

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const I_BOX = "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"
const I_CLOCK = "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z"
const I_ALERT = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
const I_LAYERS = "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"

function Delta({ change }: { change: number | null }) {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
  if (change === null) return <span className={`${base} bg-line/60 text-muted`}>Nouveau</span>
  if (change === 0) return <span className={`${base} bg-line/60 text-muted`}>Stable</span>
  const up = change > 0
  return (
    <span className={`${base} ${up ? "bg-emerald-500/10 text-emerald-700" : "bg-danger/10 text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(change)} %
    </span>
  )
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 22}`).join(" ")
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-2 h-7 w-full" aria-hidden="true">
      <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Kpi({
  label, value, metric, hint, tone = "", spark, wide = false,
}: {
  label: string
  value: string | number
  metric?: DashboardMetric
  hint?: string
  tone?: string
  spark?: ReactNode
  wide?: boolean
}) {
  return (
    <div data-tour="dash-kpi" className={`rounded-card border border-line bg-surface p-4 shadow-card ${wide ? "col-span-2" : ""}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <p className={`min-w-0 break-words text-xl font-extrabold sm:text-2xl ${tone}`}>{value}</p>
        {metric && <Delta change={metric.change} />}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {spark}
    </div>
  )
}

type Tone = "accent" | "info" | "danger" | "warn"
const TONES: Record<Tone, string> = {
  accent: "border-accent/40 bg-accent/10 text-accent",
  info: "border-sky-300 bg-sky-500/10 text-sky-700",
  danger: "border-danger/40 bg-danger/10 text-danger",
  warn: "border-amber-300 bg-amber-500/10 text-amber-700",
}

function ActionTile({ icon, label, value, to, tone }: { icon: string; label: string; value: number; to: string; tone: Tone }) {
  const on = value > 0
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-card border p-3 transition hover:shadow-card-lg active:scale-[0.99] sm:p-4 ${on ? TONES[tone] : "border-line bg-surface text-muted"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-surface/70" : "bg-line/50"}`}>
        <Icon d={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold leading-none">{value}</span>
        <span className="mt-1 block text-xs font-medium leading-tight text-ink/80">{label}</span>
      </span>
    </Link>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section data-tour="dash-card" className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-muted">{text}</p>
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
            <span className="whitespace-nowrap text-xs text-muted sm:text-sm">{i.display}</span>
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

/* ---------- Courbe des ventes (SVG, sans dependance) ---------- */

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / p
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return n * p
}

const CH = 220, PL = 52, PR = 12, PT = 12, PB = 26

function SalesChart({
  series, granularity, metric, locale,
}: {
  series: { date: string; revenue: number; orders: number }[]
  granularity: "day" | "month"
  metric: "revenue" | "orders"
  locale: string
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const n = series.length
  const values = series.map((s) => s[metric])
  const rawMax = Math.max(0, ...values)
  const top = metric === "orders" ? Math.max(4, Math.ceil(rawMax / 4) * 4) : niceMax(rawMax)
  const innerW = Math.max(10, width - PL - PR)
  const innerH = CH - PT - PB
  const x = (i: number) => PL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PT + innerH - (v / top) * innerH
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })
  const fmtVal = (v: number) => (metric === "revenue" ? formatPrice(v) : String(v))
  const parse = (d: string) => new Date(granularity === "month" ? `${d}-01` : d)
  const short = (d: string) =>
    parse(d).toLocaleDateString(locale, granularity === "month" ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" })
  const full = (d: string) =>
    parse(d).toLocaleDateString(locale, granularity === "month" ? { month: "long", year: "numeric" } : { weekday: "short", day: "2-digit", month: "long" })

  if (n === 0) return <p className="py-8 text-center text-sm text-muted">Aucune donnée sur cette période.</p>

  const total = values.reduce((a, v) => a + v, 0)
  const peakIdx = values.indexOf(rawMax)
  const ticks = [0, 1, 2, 3, 4].map((i) => (top * i) / 4)
  const labelCount = Math.min(n, width < 420 ? 3 : 6)
  const labelIdx = Array.from(new Set(Array.from({ length: labelCount }, (_, k) => (labelCount === 1 ? 0 : Math.round((k / (labelCount - 1)) * (n - 1))))))
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const hp = hover !== null ? series[hover] : null
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 80), Math.max(80, width - 80)) : 0

  function onMove(e: RPointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - PL) / innerW
    setHover(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))))
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        Total <span className="font-semibold text-ink">{fmtVal(total)}</span>
        {rawMax > 0 && <> · Pic : <span className="font-semibold text-ink">{fmtVal(rawMax)}</span> ({short(series[peakIdx].date)})</>}
      </p>
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={CH}
            role="img"
            aria-label={`Courbe : total ${fmtVal(total)} sur ${n} points`}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            className="block touch-pan-y select-none"
          >
            <defs>
              <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--color-primary)", stopOpacity: 0.25 }} />
                <stop offset="100%" style={{ stopColor: "var(--color-primary)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {ticks.map((tk) => (
              <g key={tk}>
                <line x1={PL} x2={width - PR} y1={y(tk)} y2={y(tk)} className="stroke-line" strokeDasharray={tk === 0 ? undefined : "3 4"} />
                <text x={PL - 8} y={y(tk) + 4} textAnchor="end" className="fill-muted text-[11px]">{compact.format(tk)}</text>
              </g>
            ))}
            <path d={area} fill="url(#dash-area)" />
            <path d={line} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {labelIdx.map((i) => (
              <text key={i} x={x(i)} y={CH - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                {short(series[i].date)}
              </text>
            ))}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PT} y2={y(0)} className="stroke-primary/40" />
                <circle cx={x(hover)} cy={y(values[hover])} r="4.5" className="fill-surface stroke-primary" strokeWidth="2" />
              </g>
            )}
          </svg>
        )}
        {hp && (
          <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card-lg" style={{ left: tipLeft }}>
            <p className="font-semibold capitalize">{full(hp.date)}</p>
            <p className="mt-0.5">{formatPrice(hp.revenue)}</p>
            <p className="text-muted">{hp.orders} commande(s) payée(s)</p>
          </div>
        )}
      </div>
      {total === 0 && <p className="mt-2 text-center text-sm text-muted">Aucune vente sur cette période.</p>}
    </div>
  )
}

/* ---------- Constantes ---------- */

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

const pill = "rounded-full border px-3 py-1.5 text-sm font-medium transition"

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
  if (isLoading || !data) return <DashboardSkeleton />

  const m = data.metrics
  const s = data.snapshot
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })
  const statusTotal = data.statuses.reduce((n, x) => n + x.count, 0)
  const todoTotal = s.orders_to_process + s.orders_failed + s.low_stock_count

  function exportSeries() {
    const rows = [
      ["Date", "Chiffre d'affaires", "Commandes payées"],
      ...data!.series.map((p) => [p.date, String(p.revenue), String(p.orders)]),
    ]
    const csv = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n")
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `statistiques-${data!.period.from}_${data!.period.to}.csv`)
  }

  return (
    <div className="space-y-8">
      {/* En-tete et periode */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{t("admin.dashboard", { defaultValue: "Tableau de bord" })}</h2>
            <p className={`text-sm ${todoTotal > 0 ? "text-accent" : "text-emerald-700"}`}>
              {todoTotal > 0 ? `${todoTotal} point(s) demandent votre attention` : "Tout est à jour"}
            </p>
          </div>
          <p className="text-xs text-muted">
            {fmtDate(data.period.from)} – {fmtDate(data.period.to)}
            {isFetching && " · mise à jour…"}
          </p>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" data-tour="dash-range" aria-label={t("admin.period", { defaultValue: "Période" })}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`${pill} shrink-0 whitespace-nowrap ${range === r.id ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:text-ink"}`}
            >
              {t(`admin.range_${r.id}`, { defaultValue: r.label })}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Du"
              className="min-h-[40px] rounded-lg border border-line bg-surface px-2 py-1.5" />
            <span className="text-muted">au</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Au"
              className="min-h-[40px] rounded-lg border border-line bg-surface px-2 py-1.5" />
          </div>
        )}
        <p className="text-xs text-muted">Comparé à {fmtDate(data.period.previous_from)} – {fmtDate(data.period.previous_to)}</p>
      </div>

      <div className={`space-y-8 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {/* A faire maintenant (independant de la periode) */}
        <section>
          <Heading>{t("admin.todo_now", { defaultValue: "À faire maintenant" })}</Heading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ActionTile icon={I_BOX} tone="accent" value={s.orders_to_process} label={t("admin.kpi_to_process", { defaultValue: "Commandes à traiter" })} to="/admin/boutique/commandes?quick=to_process" />
            <ActionTile icon={I_CLOCK} tone="info" value={s.orders_pending} label={t("admin.kpi_pending", { defaultValue: "En attente de paiement" })} to="/admin/boutique/commandes?status=pending" />
            <ActionTile icon={I_ALERT} tone="danger" value={s.orders_failed} label={t("admin.kpi_failed", { defaultValue: "Paiements échoués" })} to="/admin/boutique/commandes?status=failed" />
            <ActionTile icon={I_LAYERS} tone="warn" value={s.low_stock_count} label={t("admin.kpi_low_stock", { defaultValue: "Produits en stock faible" })} to="/admin/boutique/stock?filter=low" />
          </div>
        </section>

        {/* Indicateurs */}
        <section>
          <Heading>{t("admin.performance", { defaultValue: "Performance de la période" })}</Heading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi wide label={t("admin.kpi_revenue", { defaultValue: "Chiffre d'affaires" })} value={formatPrice(m.revenue.value)} metric={m.revenue} tone="text-primary"
              spark={<Spark values={data.series.map((p) => p.revenue)} />} />
            <Kpi label={t("admin.kpi_paid_orders", { defaultValue: "Commandes payées" })} value={m.paid_orders.value} metric={m.paid_orders} />
            <Kpi label={t("admin.kpi_avg_basket", { defaultValue: "Panier moyen" })} value={formatPrice(m.avg_basket.value)} metric={m.avg_basket} />
            <Kpi label={t("admin.kpi_payment_rate", { defaultValue: "Taux de paiement" })} value={`${m.payment_rate.value} %`} metric={m.payment_rate}
              tone={m.orders_created.value > 0 && m.payment_rate.value < 50 ? "text-danger" : ""} />
            <Kpi label={t("admin.kpi_orders_created", { defaultValue: "Commandes créées" })} value={m.orders_created.value} metric={m.orders_created} />
            <Kpi label={t("admin.kpi_new_customers", { defaultValue: "Nouveaux clients" })} value={m.new_customers.value} metric={m.new_customers} />
            <Kpi label={t("admin.kpi_revenue_total", { defaultValue: "CA total (depuis le début)" })} value={formatPrice(s.revenue_total)} hint="Toutes périodes" />
          </div>
        </section>

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
                    className={`min-h-[32px] px-3 ${chartMetric === k ? "bg-primary text-white" : "bg-surface text-muted"}`}>
                    {k === "revenue" ? "CA" : "Commandes"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={exportSeries} className="min-h-[32px] rounded-lg border border-line px-3 text-xs font-medium text-muted hover:text-ink">
                Exporter CSV
              </button>
            </div>
          }
        >
          <SalesChart series={data.series} granularity={data.period.granularity} metric={chartMetric} locale={locale} />
        </Card>

        {/* Statuts et livraison */}
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

          <Card title={t("admin.deliveries", { defaultValue: "Modes de livraison" })}>
            <RankList
              empty="Aucune livraison sur cette période."
              items={data.deliveries.map((d) => ({ key: d.method, label: DELIVERY_LABEL[d.method] ?? d.method, value: d.orders, display: `${d.orders} cmd · ${formatPrice(d.revenue)}` }))}
            />
          </Card>
        </div>

        {/* A traiter / a relancer */}
        <section>
          <Heading>{t("admin.follow_up", { defaultValue: "Suivi des commandes et du stock" })}</Heading>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t("admin.to_process", { defaultValue: "Commandes à traiter" })}
              action={<Link to="/admin/boutique/commandes?quick=to_process" className="text-sm font-semibold text-primary hover:underline">Voir tout</Link>}>
              {data.to_process.length === 0 ? (
                <Empty text="Rien à traiter pour le moment." />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {data.to_process.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
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

            <Card title={t("admin.failed_orders", { defaultValue: "Paiements échoués à relancer" })}
              action={<Link to="/admin/boutique/commandes?status=failed" className="text-sm font-semibold text-primary hover:underline">Voir tout</Link>}>
              {data.failed_orders.length === 0 ? (
                <Empty text="Aucun paiement échoué." />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {data.failed_orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0">
                        <span className="font-medium">#{o.id} · {o.customer}</span>
                        <span className="block text-xs text-muted">{fmtDate(o.created_at)}</span>
                      </span>
                      <span className="font-medium text-danger">{formatPrice(o.total, o.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t("admin.low_stock", { defaultValue: "Stock faible" })}
              action={<Link to="/admin/boutique/stock?filter=low" className="text-sm font-semibold text-primary hover:underline">Voir tout</Link>}>
              {data.low_stock.length === 0 ? (
                <Empty text={t("admin.stock_ok", { defaultValue: "Aucun produit en stock faible." })} />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link to={`/admin/boutique/stock?q=${encodeURIComponent(p.name)}`} className="min-w-0 truncate font-medium hover:text-primary hover:underline">{p.name}</Link>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? "bg-danger/10 text-danger" : "bg-accent/15 text-accent"}`}>
                        {p.stock === 0 ? "Rupture" : `${p.stock} en stock`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t("admin.recent_orders", { defaultValue: "Dernières commandes" })}
              action={<Link to="/admin/boutique/commandes" className="text-sm font-semibold text-primary hover:underline">{t("admin.see_all", { defaultValue: "Voir tout" })}</Link>}>
              {data.recent_orders.length === 0 ? (
                <Empty text="Aucune commande pour le moment." />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {data.recent_orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
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
            </Card>
          </div>
        </section>

        {/* Classements */}
        <section>
          <Heading>{t("admin.rankings", { defaultValue: "Classements de la période" })}</Heading>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title={t("admin.top_products", { defaultValue: "Produits les plus vendus" })}>
              <RankList
                empty={t("admin.no_sales", { defaultValue: "Aucune vente pour le moment." })}
                items={data.top_products.map((p) => ({ key: p.id, label: p.name, value: p.revenue, display: `× ${p.quantity} · ${formatPrice(p.revenue)}` }))}
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
        </section>

        {/* Vue d'ensemble */}
        <Card title={t("admin.activity_summary", { defaultValue: "Vue d'ensemble" })}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-page p-3"><dt className="text-muted">Clients inscrits</dt><dd className="text-xl font-extrabold">{s.users_total}</dd></div>
            <div className="rounded-lg bg-page p-3"><dt className="text-muted">Produits au catalogue</dt><dd className="text-xl font-extrabold">{s.products_total}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  )
}