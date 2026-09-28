import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ordersApi } from "../api/orders"
import { formatPrice } from "../lib/format"
import { getErrorMessage } from "../lib/errors"
import { statusBadgeClass } from "../lib/orderStatus"
import { toast } from "../stores/toastStore"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import Button from "../components/Button"
import type { Order } from "../types"

function OrderCard({ order }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const retry = useMutation({
    mutationFn: async () => (await ordersApi.retryPayment(order.id)).data,
    onSuccess: (data) => window.location.assign(data.payment_url),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const canRetry = order.status === "pending" || order.status === "failed"
  const date = new Date(order.created_at).toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{t("orders.order_no", { id: order.id })}</p>
          <p className="text-sm text-muted">{date}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>
          {t(`status.${order.status}`, { defaultValue: order.status_label })}
        </span>
      </div>

      {order.items && order.items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {order.items.map((line) => (
            <li key={line.id} className="flex justify-between gap-4">
              <span className="min-w-0 truncate">
                {line.item?.title ?? line.item?.name ?? t("orders.item")}
                {line.quantity > 1 && <span className="text-muted"> × {line.quantity}</span>}
              </span>
              <span className="whitespace-nowrap text-muted">{formatPrice(line.line_total, order.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-bold text-primary">{formatPrice(order.total, order.currency)}</p>
        {canRetry && (
          <Button loading={retry.isPending} onClick={() => retry.mutate()} className="w-full sm:w-auto">
            {retry.isPending ? t("orders.redirecting") : t("orders.retry")}
          </Button>
        )}
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
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("orders.empty")} actionTo="/boutique" actionLabel={t("cart.go_shop")} />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  )
}