import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import { saveBlob } from "../lib/download"
import { toast } from "../stores/toastStore"
import Button from "./Button"

export default function InvoiceButton({ orderId, size = "md", className }: { orderId: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const res = await ordersApi.invoice(orderId)
      saveBlob(res.data, `facture-${orderId}.pdf`)
    } catch {
      toast.error(t("orders.invoice_error", { defaultValue: "Impossible de télécharger la facture." }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size={size} loading={loading} className={className} onClick={() => void download()}>
      {t("orders.invoice", { defaultValue: "Télécharger la facture" })}
    </Button>
  )
}