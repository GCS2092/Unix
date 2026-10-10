import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import BackLink from "../components/BackLink"
import OrderDetailView from "../components/OrderDetailView"
import { ErrorState, LoadingState } from "../components/States"

export default function OrderDetailPage() {
  const { i18n } = useTranslation()
  const { id } = useParams()
  const orderId = Number(id)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await ordersApi.show(orderId)).data.data,
    enabled: Number.isFinite(orderId) && orderId > 0,
    staleTime: 0,
  })

  return (
    <div>
      <BackLink to="/commandes">{i18n.language.startsWith("fr") ? "Mes commandes" : "My orders"}</BackLink>
      <div className="mt-3">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && <OrderDetailView order={data} />}
      </div>
    </div>
  )
}