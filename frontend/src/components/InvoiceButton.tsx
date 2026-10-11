import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import { saveBlob } from "../lib/download"
import { toast } from "../stores/toastStore"
import Button from "./Button"

// guestToken : suivi sans compte (le lien secret donne droit a la facture de cette commande)
export default function InvoiceButton({
  orderId,
  guestToken,
  size = "md",
  className,
}: {
  orderId: number
  guestToken?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const res = guestToken ? await ordersApi.trackInvoice(guestToken) : await ordersApi.invoice(orderId)
      const cd = String(res.headers["content-disposition"] ?? "")
      const m = /filename="?([^";]+)"?/i.exec(cd)
      saveBlob(res.data, m ? m[1] : `facture-${orderId}.pdf`)
    } catch {
      toast.error(t("orders.invoice_error", { defaultValue: "Impossible de t\u00e9l\u00e9charger la facture." }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size={size} loading={loading} className={className} onClick={() => void download()}>
      {t("orders.invoice", { defaultValue: "T\u00e9l\u00e9charger la facture" })}
    </Button>
  )
}