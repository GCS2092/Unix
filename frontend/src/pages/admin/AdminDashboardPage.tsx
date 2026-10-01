import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { statusBadgeClass } from "../../lib/orderStatus"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"

function Kpi({ label, value, to, tone = "" }: { label: string; value: string | number; to?: string; tone?: string }) {
  const body = (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card transition hover:shadow-card-lg">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {children}
    </section>
  )
}

export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await adminApi.dashboard()).data.data,
    staleTime: 30_000,
  })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) {
    return (
      <div role="status" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-56" />
      </div>
    )
  }

  const k = data.kpis
  const max = Math.max(1, ...data.sales.map((s) => s.total))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("admin.kpi_revenue_today", { defaultValue: "CA aujourd'hui" })} value={formatPrice(k.revenue_today)} tone="text-primary" />
        <Kpi label={t("admin.kpi_revenue_30d", { defaultValue: "CA sur 30 jours" })} value={formatPrice(k.revenue_30d)} />
        <Kpi label={t("admin.kpi_revenue_total", { defaultValue: "CA total" })} value={formatPrice(k.revenue_total)} />
        <Kpi label={t("admin.kpi_orders_today", { defaultValue: "Commandes du jour" })} value={k.orders_today} to="/admin/commandes" />
        <Kpi label={t("admin.kpi_to_process", { defaultValue: "À traiter" })} value={k.orders_to_process} to="/admin/commandes" tone={k.orders_to_process > 0 ? "text-accent" : ""} />
        <Kpi label={t("admin.kpi_pending", { defaultValue: "En attente de paiement" })} value={k.orders_pending} to="/admin/commandes" />
        <Kpi label={t("admin.kpi_failed", { defaultValue: "Paiements échoués" })} value={k.orders_failed} to="/admin/commandes" tone={k.orders_failed > 0 ? "text-danger" : ""} />
        <Kpi label={t("admin.kpi_products", { defaultValue: "Produits" })} value={k.products_total} to="/admin/produits" />
      </div>

      <Card title={t("admin.sales_chart", { defaultValue: "Ventes des 14 derniers jours" })}>
        <div className="flex h-44 items-end gap-1.5 sm:gap-2">
          {data.sales.map((s) => (
            <div key={s.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${s.date} : ${formatPrice(s.total)}`}>
              <div
                className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                style={{ height: `${Math.max(2, (s.total / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{new Date(data.sales[0].date).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
          <span>{new Date(data.sales[data.sales.length - 1].date).toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("admin.top_products", { defaultValue: "Produits les plus vendus" })}>
          {data.top_products.length === 0 ? (
            <p className="text-sm text-muted">{t("admin.no_sales", { defaultValue: "Aucune vente pour le moment." })}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.top_products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="whitespace-nowrap text-muted">× {p.quantity} · {formatPrice(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("admin.low_stock", { defaultValue: "Stock faible" })}>
          {data.low_stock.length === 0 ? (
            <p className="text-sm text-muted">{t("admin.stock_ok", { defaultValue: "Aucun produit en stock faible." })}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.low_stock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? "bg-danger/10 text-danger" : "bg-accent/15 text-accent"}`}>
                    {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t("admin.recent_orders", { defaultValue: "Dernières commandes" })}>
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
        <Link to="/admin/commandes" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          {t("admin.see_all", { defaultValue: "Voir tout" })}
        </Link>
      </Card>
    </div>
  )
}