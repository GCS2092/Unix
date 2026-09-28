import { useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../api/client"
import { formatPrice } from "../lib/format"
import { statusBadgeClass } from "../lib/orderStatus"
import { ErrorState, LoadingState } from "../components/States"
import { useCartStore } from "../stores/cartStore"
import type { ApiResource } from "../types"

interface CheckoutStatus {
  order_id: number
  status: string
  status_label: string
  total: number
  currency: string
  is_paid: boolean
  is_failed: boolean
}

export default function CheckoutReturnPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const transactionId = params.get("transaction_id")
  const fetchCart = useCartStore((s) => s.fetch)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["checkout-status", transactionId],
    enabled: !!transactionId,
    queryFn: async () =>
      (await apiClient.get<ApiResource<CheckoutStatus>>("/checkout/status", { params: { transaction_id: transactionId } })).data.data,
    // Le webhook peut arriver quelques secondes après le retour du client
    refetchInterval: (query) => (query.state.data && !query.state.data.is_paid && !query.state.data.is_failed ? 3000 : false),
    staleTime: 0,
  })

  useEffect(() => {
    if (order?.is_paid) void fetchCart().catch(() => undefined)
  }, [order?.is_paid, fetchCart])

  if (!transactionId) {
    return <p className="py-16 text-center text-danger">{t("return.not_found")}</p>
  }
  if (isLoading) return <LoadingState />
  if (error || !order) return <ErrorState error={error} />

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-4 text-2xl font-bold">{t("orders.order_no", { id: order.order_id })}</h1>
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(order.status)}`}>
        {t(`status.${order.status}`, { defaultValue: order.status_label })}
      </span>
      <p className="mt-4">{formatPrice(order.total, order.currency)}</p>
      {order.is_paid && <p className="mt-4 text-success">{t("return.paid")}</p>}
      {!order.is_paid && !order.is_failed && <p className="mt-4 text-muted">{t("return.pending")}</p>}
      {order.is_failed && <p className="mt-4 text-danger">{t("return.failed")}</p>}
      <Link to="/commandes" className="mt-6 inline-block font-semibold text-primary">{t("return.view_orders")}</Link>
    </div>
  )
}