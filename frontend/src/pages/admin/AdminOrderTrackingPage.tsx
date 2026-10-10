import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../../api/orders"
import { getErrorMessage } from "../../lib/errors"
import { fulfillmentLabelKey } from "../../lib/fulfillment"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { ErrorState, LoadingState } from "../../components/States"
import type { AdminOrder } from "../../types"

const field =
  "min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

function TrackingForm({ order }: { order: AdminOrder }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const qc = useQueryClient()
  const [carrier, setCarrier] = useState(order.carrier ?? "")
  const [number, setNumber] = useState(order.tracking_number ?? "")
  const [pickup, setPickup] = useState(order.pickup_note ?? "")
  const [serials, setSerials] = useState(order.serial_numbers ?? "")
  const [warranty, setWarranty] = useState(order.warranty_months != null ? String(order.warranty_months) : "")

  const save = useMutation({
    mutationFn: () =>
      ordersApi.adminTracking(order.id, {
        carrier,
        tracking_number: number,
        pickup_note: pickup,
        serial_numbers: serials,
        warranty_months: warranty.trim() === "" ? null : Number(warranty),
      }),
    onSuccess: () => {
      toast.success(fr ? "Suivi enregistré" : "Tracking saved")
      void qc.invalidateQueries({ queryKey: ["admin-order-tracking", order.id] })
      void qc.invalidateQueries({ queryKey: ["admin-orders"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const delivery = order.delivery_method === "delivery"
  const pickupMode = order.delivery_method === "pickup"
  const name = order.user?.name ?? order.guest_name ?? ""
  const phoneDigits = (order.phone ?? "").replace(/\D/g, "").replace(/^00/, "")
  const stepLabel = order.fulfillment_status ? t(fulfillmentLabelKey(order.fulfillment_status, order.delivery_method)) : ""
  const msg = [
    fr ? `Bonjour ${name}, point sur votre commande n°${order.id}${stepLabel ? ` : ${stepLabel}.` : "."}` : `Hello ${name}, update on your order #${order.id}${stepLabel ? `: ${stepLabel}.` : "."}`,
    delivery && carrier ? `${fr ? "Transporteur" : "Carrier"} : ${carrier}` : "",
    delivery && number ? `${fr ? "N° de suivi" : "Tracking no."} : ${number}` : "",
    pickupMode && pickup ? `${fr ? "Lieu de retrait" : "Pickup location"} : ${pickup}` : "",
  ].filter(Boolean).join("\n")

  return (
    <div className="space-y-4">
      {delivery && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {fr ? "Transporteur" : "Carrier"}
            <input className={`${field} mt-1`} value={carrier} maxLength={80} onChange={(e) => setCarrier(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            {fr ? "Numéro de suivi" : "Tracking number"}
            <input className={`${field} mt-1`} value={number} maxLength={80} onChange={(e) => setNumber(e.target.value)} />
          </label>
        </div>
      )}
      {pickupMode && (
        <label className="block text-sm font-medium">
          {fr ? "Lieu et horaires de retrait" : "Pickup location and hours"}
          <input className={`${field} mt-1`} value={pickup} maxLength={255} onChange={(e) => setPickup(e.target.value)} />
        </label>
      )}
      <label className="block text-sm font-medium">
        {fr ? "Numéros de série (un par ligne)" : "Serial numbers (one per line)"}
        <textarea className={`${field} mt-1 resize-none`} rows={3} maxLength={2000} value={serials} onChange={(e) => setSerials(e.target.value)} />
      </label>
      <label className="block text-sm font-medium sm:max-w-[14rem]">
        {fr ? "Garantie (mois)" : "Warranty (months)"}
        <input className={`${field} mt-1`} type="number" min={0} max={120} inputMode="numeric" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
      </label>
      <p className="text-xs text-muted">
        {fr
          ? "Renseignez le transporteur et le numéro de suivi avant de passer la commande à « Expédiée » : l'e-mail au client les contiendra."
          : "Fill in the carrier and tracking number before moving the order to “Shipped”: the customer email will include them."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button loading={save.isPending} onClick={() => save.mutate()} className="w-full sm:w-auto">
          {fr ? "Enregistrer" : "Save"}
        </Button>
        {phoneDigits && (
          <a
            href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center rounded-lg border border-[#25D366] px-4 text-sm font-semibold text-[#0f6b4a] hover:bg-[#25D366]/10 sm:w-auto"
          >
            {fr ? "Prévenir le client sur WhatsApp" : "Notify customer on WhatsApp"}
          </a>
        )}
      </div>
      {phoneDigits && (
        <p className="text-xs text-muted">
          {fr ? "Le numéro doit contenir l'indicatif du pays pour que le lien WhatsApp fonctionne." : "The number must include the country code for the WhatsApp link to work."}
        </p>
      )}
    </div>
  )
}

export default function AdminOrderTrackingPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { id } = useParams()
  const orderId = Number(id)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-order-tracking", orderId],
    queryFn: async () => (await ordersApi.adminShow(orderId)).data.data,
    enabled: Number.isFinite(orderId) && orderId > 0,
    staleTime: 0,
  })

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin/boutique/commandes" className="text-sm font-semibold text-primary">← {fr ? "Commandes" : "Orders"}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold sm:text-2xl">
        {fr ? `Suivi de la commande n°${orderId}` : `Tracking for order #${orderId}`}
      </h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
          <TrackingForm key={data.id} order={data} />
        </div>
      )}
    </div>
  )
}