import { useEffect } from "react"
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

  const comms = useQuery({
    queryKey: ["public-comms"],
    queryFn: async () => (await ordersApi.communications()).data.data,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const announcement = comms.data ? (fr ? comms.data.announcement_fr : comms.data.announcement_en) : ""

  // Le lien contient un secret : pas d'indexation, pas de fuite via l'en-tete Referer
  useEffect(() => {
    const tags = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const m = document.createElement("meta")
      m.name = name
      m.content = content
      document.head.appendChild(m)
      return m
    })
    return () => tags.forEach((m) => m.remove())
  }, [])

  return (
    <div>
      <p className="mb-3 text-center text-sm text-muted">{fr ? "Suivi de votre commande" : "Tracking your order"}</p>
      {announcement && (
        <p role="status" className="mx-auto mb-3 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
          {announcement}
        </p>
      )}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <OrderDetailView order={data} guestToken={token} />}
    </div>
  )
}