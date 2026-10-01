import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <p className="text-sm">
      <span className="text-muted">{label} : </span>
      <span className="font-medium">{value}</span>
    </p>
  )
}

export default function AdminOrderPrintPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const { data: o, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => (await adminApi.order(Number(id))).data.data,
  })

  if (isLoading) return <LoadingState />
  if (error || !o) return <ErrorState error={error} onRetry={() => void refetch()} />

  const customer = o.user?.name ?? o.guest_name ?? t("admin.guest")
  const email = o.user?.email ?? o.guest_email
  const address = [o.address, o.district, o.city].filter(Boolean).join(", ")

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link to="/admin/commandes" className="text-sm font-semibold text-primary hover:underline">
          ← {t("admin.orders")}
        </Link>
        <Button onClick={() => window.print()}>{t("admin.print", { defaultValue: "Imprimer" })}</Button>
      </div>

      <div id="print-area" className="rounded-card border border-line bg-surface p-6 shadow-card print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-2xl font-bold">{t("admin.delivery_note", { defaultValue: "Bon de livraison" })}</h2>
            <p className="text-sm text-muted">{t("admin.col_date")} : {new Date(o.created_at).toLocaleDateString(locale)}</p>
          </div>
          <p className="text-2xl font-bold">#{o.id}</p>
        </div>

        <div className="grid gap-6 py-4 sm:grid-cols-2">
          <div className="space-y-1">
            <h3 className="mb-1 text-sm font-semibold uppercase text-muted">{t("admin.col_customer")}</h3>
            <p className="font-medium">{customer}</p>
            <Row label={t("admin.phone")} value={o.phone} />
            <Row label="E-mail" value={email} />
          </div>
          <div className="space-y-1">
            <h3 className="mb-1 text-sm font-semibold uppercase text-muted">{t("admin.delivery")}</h3>
            <Row label={t("admin.delivery")} value={o.delivery_method ? t(`admin.method_${o.delivery_method}`, { defaultValue: o.delivery_method }) : null} />
            <Row label={t("admin.zone")} value={o.delivery_zone ? t(`checkout.zone_${o.delivery_zone}`, { defaultValue: o.delivery_zone }) : null} />
            <Row label={t("admin.address")} value={address} />
            <Row label={t("admin.landmark")} value={o.landmark} />
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-y border-line text-muted">
            <tr>
              <th className="py-2 font-medium">{t("admin.col_product")}</th>
              <th className="py-2 text-right font-medium">{t("admin.qty", { defaultValue: "Qté" })}</th>
              <th className="py-2 text-right font-medium">{t("admin.col_total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(o.items ?? []).map((line) => (
              <tr key={line.id}>
                <td className="py-2">{line.item?.title ?? line.item?.name ?? t("orders.item")}</td>
                <td className="py-2 text-right">{line.quantity}</td>
                <td className="py-2 text-right whitespace-nowrap">{formatPrice(line.line_total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          {o.subtotal !== undefined && (
            <p className="flex justify-between"><span className="text-muted">{t("admin.subtotal")}</span><span>{formatPrice(o.subtotal, o.currency)}</span></p>
          )}
          {o.delivery_fee !== undefined && (
            <p className="flex justify-between"><span className="text-muted">{t("admin.delivery_fee")}</span><span>{formatPrice(o.delivery_fee, o.currency)}</span></p>
          )}
          <p className="flex justify-between border-t border-line pt-1 text-base font-bold">
            <span>{t("admin.col_total")}</span><span>{formatPrice(o.total, o.currency)}</span>
          </p>
        </div>

        {o.note && (
          <p className="mt-6 text-sm"><span className="text-muted">{t("admin.note")} : </span>{o.note}</p>
        )}
        <div className="mt-12 grid grid-cols-2 gap-8 text-sm text-muted">
          <p className="border-t border-line pt-2">{t("admin.signature_seller", { defaultValue: "Signature du vendeur" })}</p>
          <p className="border-t border-line pt-2">{t("admin.signature_customer", { defaultValue: "Signature du client" })}</p>
        </div>
      </div>
    </div>
  )
}