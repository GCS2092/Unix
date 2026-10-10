import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import OrderDetailView from "../components/OrderDetailView"
import { ErrorState, LoadingState } from "../components/States"

// Suivi sans compte : le lien secret recu par e-mail suffit
export default function TrackPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { token = "" } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["track", token],
    queryFn: async () => (await ordersApi.track(token)).data.data,
    enabled: token !== "",
    staleTime: 0,
    refetchInterval: 60_000,
    retry: false,
  })

  return (
    <div>
      <p className="mb-3 text-center text-sm text-muted">{fr ? "Suivi de votre commande" : "Tracking your order"}</p>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <OrderDetailView order={data} guestToken={token} />}
    </div>
  )
}