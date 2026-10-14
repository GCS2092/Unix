import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, ClipboardCheck, Clock, MessageCircle, Package, PackageCheck, Truck, type LucideIcon } from "lucide-react"
import { ordersApi } from "../api/orders"
import { formatPrice } from "../lib/format"
import { getErrorMessage } from "../lib/errors"
import { statusBadgeClass } from "../lib/orderStatus"
import { fulfillmentLabelKey } from "../lib/fulfillment"
import { toast } from "../stores/toastStore"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import AuthNotices from "../components/AuthNotices"
import Button from "../components/Button"
import { buttonClass } from "../components/buttonStyles"
import FulfillmentTracker from "../components/FulfillmentTracker"
import InvoiceButton from "../components/InvoiceButton"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"
import { openWaDesk } from "../lib/waDesk"
import type { Order } from "../types"

const ACCENT: Record<string, string> = {
  paid: "border-l-success",
  pending: "border-l-primary",
  failed: "border-l-danger",
  cancelled: "border-l-danger",
}

const iconBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary hover:text-primary active:scale-95"

// "CMD-332Q-DC5G" -> prefixe attenue, code en evidence
function Ref({ value }: { value: string }) {
  const m = /^([A-Za-z]+-)(.+)$/.exec(value)
  if (!m) return <>{value}</>
  return (
    <>
      <span className="font-normal text-muted/70">{m[1]}</span>
      {m[2]}
    </>
  )
}

const STEP_ICON: Record<string, LucideIcon> = { received: ClipboardCheck, preparing: Package, shipped: Truck, ready: PackageCheck, delivered: CircleCheck }
const STATUS_ICON: Record<string, LucideIcon> = { paid: CircleCheck, pending: Clock, failed: CircleAlert, cancelled: CircleAlert }

function BadgeIcon({ step, status }: { step?: string | null; status: string }) {
  const Icon = (step ? STEP_ICON[step] : undefined) ?? STATUS_ICON[status]
  return Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" /> : null
}

function OrderCard({ order }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const retry = useMutation({
    mutationFn: async () => (await ordersApi.retryPayment(order.id)).data,
    onSuccess: (data) => window.location.assign(data.payment_url),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const canRetry = order.status === "pending" || order.status === "failed"
  const date = new Date(order.created_at).toLocaleDateString(fr ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Commande payee avec suivi : le badge dit ou en est la commande (le paiement est sous-entendu)
  const tracked = order.status === "paid" && !!order.fulfillment_status && !!order.delivery_method && order.delivery_method !== "none"
  const stepLabel = tracked ? t(fulfillmentLabelKey(order.fulfillment_status as string, order.delivery_method)) : null
  const finished = order.fulfillment_status === "delivered"
  const badgeText = stepLabel ?? t(`status.${order.status}`, { defaultValue: order.status_label })
  const badgeClass = tracked ? (finished ? "bg-success/10 text-success" : "bg-primary/10 text-primary") : statusBadgeClass(order.status)

  const itemNames = (order.items ?? []).map(
    (line) => `${line.item?.title ?? line.item?.name ?? t("orders.item")}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
  )

  return (
    <li className={`rounded-card border border-l-4 border-line bg-surface p-4 shadow-card ${ACCENT[order.status] ?? "border-l-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono font-semibold tracking-wide">
            {order.public_ref ? <Ref value={order.public_ref} /> : t("orders.order_no", { id: order.id })}
          </p>
          <p className="text-sm text-muted">{date}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}><BadgeIcon step={tracked ? order.fulfillment_status : null} status={order.status} />{badgeText}</span>
      </div>

      {tracked && <FulfillmentTracker compact status={order.fulfillment_status} method={order.delivery_method} />}

      {itemNames.length > 0 && <p className="mt-3 truncate text-sm text-ink/80">{itemNames.join(", ")}</p>}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-lg font-bold text-primary">{formatPrice(order.total, order.currency)}</p>
        <div className="flex items-center gap-2">
          {canRetry && order.payment_manual && (
            <Link to={"/commandes/" + order.id} className={buttonClass({ size: "sm" })}>{fr ? "Comment payer" : "How to pay"}</Link>
          )}
          {canRetry && !order.payment_manual && (
            <Button size="sm" loading={retry.isPending} onClick={() => retry.mutate()}>
              {retry.isPending ? t("orders.redirecting") : t("orders.retry")}
            </Button>
          )}
          {order.status === "paid" && <InvoiceButton orderId={order.id} iconOnly />}
          {WHATSAPP_NUMBER && (
            <button
              type="button"
              aria-label={fr ? "Une question sur cette commande" : "Question about this order"}
              title={fr ? "Une question sur cette commande" : "Question about this order"}
              className={iconBtn}
              onClick={() =>
                openWaDesk({
                  kind: "order",
                  id: order.id,
                  ref: order.public_ref ?? undefined,
                  step: order.fulfillment_status ? t(fulfillmentLabelKey(order.fulfillment_status, order.delivery_method)) : undefined,
                  carrier: order.carrier || undefined,
                  trackingNumber: order.tracking_number || undefined,
                  date,
                  status: t(`status.${order.status}`, { defaultValue: order.status_label }),
                  items: itemNames,
                  total: formatPrice(order.total, order.currency),
                })
              }
            >
              <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
          <Link to={"/commandes/" + order.id} data-tour="or-details" className={buttonClass({ variant: "secondary", size: "sm" })}>
            {fr ? "Détails" : "Details"}
          </Link>
        </div>
      </div>
    </li>
  )
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await ordersApi.list()).data.data,
    staleTime: 0,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("orders.title")}</h1>
      <AuthNotices />
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("orders.empty")} actionTo="/boutique" actionLabel={t("cart.go_shop")} />
      )}
      {data && data.length > 0 && (
        <ul data-tour="or-list" className="space-y-4">
          {data.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  )
}