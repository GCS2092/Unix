import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import { formatPrice } from "../lib/format"
import { getErrorMessage } from "../lib/errors"
import { statusBadgeClass } from "../lib/orderStatus"
import { openWaDesk } from "../lib/waDesk"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"
import { toast } from "../stores/toastStore"
import Button from "./Button"
import InvoiceButton from "./InvoiceButton"
import OrderTimeline from "./OrderTimeline"
import type { Order } from "../types"

const card = "rounded-card border border-line bg-surface p-4 shadow-card"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  )
}

// Page de suivi partagee : client connecte (/commandes/:id) et invite (/suivi/:token)
export default function OrderDetailView({ order, guestToken }: { order: Order; guestToken?: string }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const fr = i18n.language.startsWith("fr")
  const locale = fr ? "fr-FR" : "en-US"
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })

  const confirm = useMutation({
    mutationFn: () => (guestToken ? ordersApi.confirmTracked(guestToken) : ordersApi.confirmReceived(order.id)),
    onSuccess: () => {
      toast.success(fr ? "Merci, la réception est confirmée." : "Thank you, receipt confirmed.")
      void qc.invalidateQueries({ queryKey: ["order"] })
      void qc.invalidateQueries({ queryKey: ["track"] })
      void qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const statusLabel = t(`status.${order.status}`, { defaultValue: order.status_label })
  const paid = order.status === "paid"
  const canConfirm = paid && ["shipped", "ready", "delivered"].includes(order.fulfillment_status ?? "") && !order.received_confirmed_at

  const deliveredAt = [...(order.events ?? [])].reverse().find((e) => e.step === "delivered")?.at ?? null
  const warrantyStart = order.received_confirmed_at ?? deliveredAt
  let warrantyEnd: Date | null = null
  if (order.warranty_months && warrantyStart) {
    warrantyEnd = new Date(warrantyStart)
    warrantyEnd.setMonth(warrantyEnd.getMonth() + order.warranty_months)
  }

  const address = [order.address, order.district, order.city].filter(Boolean).join(", ")
  const itemName = (line: NonNullable<Order["items"]>[number]) => line.item?.title ?? line.item?.name ?? t("orders.item")
  const hasSerials = !!order.serial_numbers?.trim()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{t("orders.order_no", { id: order.id })}</h1>
            <p className="text-sm text-muted">{day(order.created_at)}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>{statusLabel}</span>
        </div>
        {paid && <OrderTimeline order={order} />}
        {paid && !order.fulfillment_status && (
          <p className="mt-3 text-sm text-muted">{fr ? "Paiement confirmé. Votre commande va être prise en charge." : "Payment confirmed. Your order will be handled shortly."}</p>
        )}
        {order.received_confirmed_at && (
          <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
            {fr ? `Réception confirmée le ${day(order.received_confirmed_at)}` : `Receipt confirmed on ${day(order.received_confirmed_at)}`}
          </p>
        )}
        {canConfirm && (
          <Button className="mt-4 w-full" loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {fr ? "J'ai bien reçu ma commande" : "I received my order"}
          </Button>
        )}
      </div>

      {(order.delivery_method === "delivery" || order.delivery_method === "pickup") && (
        <section className={card}>
          <h2 className="mb-1 font-semibold">{order.delivery_method === "delivery" ? (fr ? "Livraison" : "Delivery") : (fr ? "Retrait" : "Pickup")}</h2>
          <dl className="divide-y divide-line">
            {order.delivery_method === "delivery" && address && <Row label={fr ? "Adresse" : "Address"}>{address}</Row>}
            {order.delivery_method === "delivery" && order.landmark && <Row label={fr ? "Repère" : "Landmark"}>{order.landmark}</Row>}
            {order.delivery_method === "delivery" && order.carrier && <Row label={fr ? "Transporteur" : "Carrier"}>{order.carrier}</Row>}
            {order.delivery_method === "delivery" && order.tracking_number && <Row label={fr ? "N° de suivi" : "Tracking no."}>{order.tracking_number}</Row>}
            {order.delivery_method === "pickup" && order.pickup_note && <Row label={fr ? "Lieu de retrait" : "Pickup location"}>{order.pickup_note}</Row>}
            {order.phone && <Row label={fr ? "Téléphone" : "Phone"}>{order.phone}</Row>}
          </dl>
        </section>
      )}

      {(hasSerials || order.warranty_months) && (
        <section className={card}>
          <h2 className="mb-1 font-semibold">{fr ? "Matériel et garantie" : "Equipment and warranty"}</h2>
          {hasSerials && (
            <div className="py-1.5 text-sm">
              <p className="text-muted">{fr ? "Numéros de série" : "Serial numbers"}</p>
              <p className="mt-1 whitespace-pre-line break-words font-medium">{order.serial_numbers}</p>
            </div>
          )}
          {order.warranty_months ? (
            <p className="py-1.5 text-sm">
              <span className="text-muted">{fr ? "Garantie : " : "Warranty: "}</span>
              <span className="font-medium">
                {warrantyEnd
                  ? fr ? `${order.warranty_months} mois, jusqu'au ${day(warrantyEnd.toISOString())}` : `${order.warranty_months} months, until ${day(warrantyEnd.toISOString())}`
                  : fr ? `${order.warranty_months} mois à compter de la réception` : `${order.warranty_months} months from receipt`}
              </span>
            </p>
          ) : null}
        </section>
      )}

      <section className={card}>
        <h2 className="mb-2 font-semibold">{fr ? "Articles" : "Items"}</h2>
        <ul className="space-y-1 text-sm">
          {(order.items ?? []).map((line) => (
            <li key={line.id} className="flex justify-between gap-4">
              <span className="min-w-0 truncate">
                {itemName(line)}
                {line.quantity > 1 && <span className="text-muted"> × {line.quantity}</span>}
              </span>
              <span className="whitespace-nowrap text-muted">{formatPrice(line.line_total, order.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {!!order.delivery_fee && (
            <p className="flex justify-between text-muted">
              <span>{fr ? "Livraison" : "Delivery"}</span>
              <span>{formatPrice(order.delivery_fee, order.currency)}</span>
            </p>
          )}
          <p className="flex justify-between text-lg font-bold">
            <span>{t("cart.total")}</span>
            <span className="text-primary">{formatPrice(order.total, order.currency)}</span>
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        {paid && !guestToken && <InvoiceButton orderId={order.id} className="w-full sm:w-auto" />}
        {WHATSAPP_NUMBER && (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() =>
              openWaDesk({
                kind: "order",
                id: order.id,
                status: statusLabel,
                items: (order.items ?? []).map((l) => `${itemName(l)}${l.quantity > 1 ? ` × ${l.quantity}` : ""}`),
                total: formatPrice(order.total, order.currency),
              })
            }
          >
            {fr ? "Une question sur cette commande" : "Question about this order"}
          </Button>
        )}
      </div>
    </div>
  )
}