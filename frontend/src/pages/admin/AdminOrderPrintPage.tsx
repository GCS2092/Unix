import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { usePublicShop } from "../../hooks/usePublicShop"
import { LOGO_SRC } from "../../lib/logoConfig"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

interface Extra {
  public_ref?: string | null
  carrier?: string | null
  tracking_number?: string | null
  pickup_note?: string | null
  serial_numbers?: string | string[] | null
  warranty_months?: number | null
  country?: string | null
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <p className="text-sm leading-snug">
      <span className="text-muted">{label} : </span>
      <span className="font-medium">{value}</span>
    </p>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-line bg-page/50 p-3 print:bg-transparent">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export default function AdminOrderPrintPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const locale = fr ? "fr-FR" : "en-US"
  const [showPrices, setShowPrices] = useState(false)
  const shopQ = usePublicShop()
  const { data: o, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => (await adminApi.order(Number(id))).data.data,
  })

  if (isLoading) return <LoadingState />
  if (error || !o) return <ErrorState error={error} onRetry={() => void refetch()} />

  const x = o as unknown as Extra
  const shop = shopQ.data
  const company = (shop?.shop_name || shop?.legal_name || "").trim()
  const ref = x.public_ref ?? `#${o.id}`
  const customer = o.user?.name ?? o.guest_name ?? t("admin.guest")
  const email = o.user?.email ?? o.guest_email
  const address = [o.address, o.district, o.city].filter(Boolean).join(", ")
  const pickup = o.delivery_method === "pickup"
  const country = x.country
    ? (() => { try { return new Intl.DisplayNames([fr ? "fr" : "en"], { type: "region" }).of(x.country!.toUpperCase()) ?? x.country } catch { return x.country } })()
    : null
  const serials = (Array.isArray(x.serial_numbers) ? x.serial_numbers : String(x.serial_numbers ?? "").split(/\r?\n/)).map((s) => s.trim()).filter(Boolean)
  const items = o.items ?? []
  const paid = o.status === "paid"
  const pickupPlace = x.pickup_note || shop?.pickup_place || null
  const companyLine = [shop?.legal_name && shop.legal_name !== company ? shop.legal_name : null, shop?.legal_address, shop?.legal_phone, shop?.legal_email].filter(Boolean).join("  \u00b7  ")

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/boutique/commandes" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline">
          {"\u2190 "}{t("admin.orders")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
            {L("Afficher les prix", "Show prices")}
          </label>
          <Button onClick={() => window.print()}>{t("admin.print", { defaultValue: "Imprimer" })}</Button>
        </div>
      </div>

      <div id="print-area" className="overflow-hidden rounded-card border border-line bg-surface shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="h-2 bg-primary" />
        <div className="space-y-5 p-5 sm:p-8 print:p-0 print:pt-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {LOGO_SRC && <img src={LOGO_SRC} alt={company} className="mb-2 block h-14 w-auto max-w-[240px] object-contain" />}
              <p className="text-lg font-extrabold text-primary">{company}</p>
              <div className="mt-0.5 space-y-0.5 text-xs text-muted">
                {shop?.legal_address && <p>{shop.legal_address}</p>}
                {shop?.legal_phone && <p>{L("T\u00e9l : ", "Phone: ")}{shop.legal_phone}</p>}
                {shop?.legal_email && <p>{shop.legal_email}</p>}
                {shop?.opening_hours && <p>{shop.opening_hours}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-extrabold uppercase tracking-wide text-primary">{L("Bon de livraison", "Delivery note")}</h2>
              <p className="mt-1 font-mono text-base font-bold">{ref}</p>
              <p className="text-xs text-muted">{L("Command\u00e9 le ", "Ordered on ")}{new Date(o.created_at).toLocaleDateString(locale)}</p>
              <p className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paid ? "border-emerald-500/40 text-emerald-700" : "border-amber-500/50 text-amber-700"}`}>
                {paid ? L("Pay\u00e9e", "Paid") : L("\u00c0 encaisser", "To collect")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Block title={L("Destinataire", "Deliver to")}>
              <p className="text-base font-bold">{customer}</p>
              <Info label={t("admin.phone")} value={o.phone} />
              <Info label="E-mail" value={email} />
            </Block>
            <Block title={pickup ? L("Retrait sur place", "Pickup") : L("Livraison", "Delivery")}>
              {pickup ? (
                <>
                  <Info label={L("Lieu", "Place")} value={pickupPlace} />
                  <Info label={L("Horaires", "Hours")} value={shop?.pickup_hours} />
                  <Info label={L("\u00c0 pr\u00e9senter", "Bring")} value={shop?.pickup_requirements} />
                </>
              ) : (
                <>
                  <Info label={t("admin.zone")} value={o.delivery_zone ? t(`checkout.zone_${o.delivery_zone}`, { defaultValue: o.delivery_zone }) : null} />
                  <Info label={L("Pays", "Country")} value={country} />
                  <Info label={t("admin.address")} value={address} />
                  <Info label={t("admin.landmark")} value={o.landmark} />
                  <Info label={L("Transporteur", "Carrier")} value={x.carrier} />
                  <Info label={L("N\u00b0 de suivi", "Tracking no.")} value={x.tracking_number} />
                </>
              )}
            </Block>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="bg-primary text-[11px] uppercase tracking-wide text-white">
                  <th className="w-8 px-2 py-2 font-semibold">#</th>
                  <th className="px-2 py-2 font-semibold">{L("D\u00e9signation", "Description")}</th>
                  <th className="w-14 px-2 py-2 text-center font-semibold">{L("Qt\u00e9", "Qty")}</th>
                  {showPrices && <th className="px-2 py-2 text-right font-semibold">{t("admin.col_total")}</th>}
                  <th className="w-16 px-2 py-2 text-center font-semibold print:w-20">{L("V\u00e9rifi\u00e9", "Checked")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.length === 0 && (
                  <tr><td colSpan={showPrices ? 5 : 4} className="px-2 py-4 text-center text-muted">{L("Aucun article.", "No items.")}</td></tr>
                )}
                {items.map((line, i) => (
                  <tr key={line.id} className="break-inside-avoid">
                    <td className="px-2 py-2.5 text-muted">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium">{line.item?.title ?? line.item?.name ?? t("orders.item")}</td>
                    <td className="px-2 py-2.5 text-center font-bold">{line.quantity}</td>
                    {showPrices && <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatPrice(line.line_total, o.currency)}</td>}
                    <td className="px-2 py-2.5 text-center"><span className="inline-block h-4 w-4 rounded border border-ink/60 align-middle" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showPrices && (
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              {o.subtotal !== undefined && <p className="flex justify-between"><span className="text-muted">{t("admin.subtotal")}</span><span>{formatPrice(o.subtotal, o.currency)}</span></p>}
              {o.delivery_fee !== undefined && <p className="flex justify-between"><span className="text-muted">{t("admin.delivery_fee")}</span><span>{formatPrice(o.delivery_fee, o.currency)}</span></p>}
              <p className="flex justify-between rounded bg-primary px-2 py-1.5 text-base font-bold text-white"><span>{t("admin.col_total")}</span><span>{formatPrice(o.total, o.currency)}</span></p>
            </div>
          )}

          {(serials.length > 0 || (x.warranty_months ?? 0) > 0 || o.note) && (
            <Block title={L("Informations", "Details")}>
              {serials.length > 0 && <Info label={L("N\u00b0 de s\u00e9rie", "Serial no.")} value={serials.join(", ")} />}
              {(x.warranty_months ?? 0) > 0 && <Info label={L("Garantie", "Warranty")} value={`${x.warranty_months} ${L("mois", "months")}`} />}
              <Info label={t("admin.note")} value={o.note} />
            </Block>
          )}

          <div className="break-inside-avoid">
            <p className="text-xs text-muted">{L("V\u00e9rifiez l'\u00e9tat et la quantit\u00e9 des articles \u00e0 la r\u00e9ception. Toute r\u00e9serve doit \u00eatre not\u00e9e ci-dessous.", "Please check the condition and quantity of the items on receipt. Note any reservation below.")}</p>
            <div className="mt-2 h-14 rounded-lg border border-dashed border-line px-3 py-1 text-[11px] text-muted">{L("R\u00e9serves \u00e9ventuelles", "Reservations")}</div>
          </div>

          <div className="grid break-inside-avoid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            {[L("Livr\u00e9 par", "Delivered by"), L("Re\u00e7u par", "Received by")].map((title) => (
              <div key={title} className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
                <p className="mt-3 border-b border-line pb-1 text-xs text-muted">{L("Nom", "Name")} :</p>
                <p className="mt-3 border-b border-line pb-1 text-xs text-muted">{L("Date", "Date")} :</p>
                <p className="mt-3 h-14 text-xs text-muted">{L("Signature", "Signature")} :</p>
              </div>
            ))}
          </div>

          <p className="border-t border-line pt-3 text-center text-[11px] text-muted">
            {companyLine || company}
          </p>
        </div>
      </div>
    </div>
  )
}