import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Loader2 } from "lucide-react"
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
  iconOnly = false,
}: {
  orderId: number
  guestToken?: string
  size?: "sm" | "md" | "lg"
  className?: string
  iconOnly?: boolean
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const label = t("orders.invoice", { defaultValue: "T\u00e9l\u00e9charger la facture" })

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

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        aria-label={label}
        title={label}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      >
        {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <FileText className="h-[18px] w-[18px]" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <Button variant="secondary" size={size} loading={loading} className={className} onClick={() => void download()}>
      {label}
    </Button>
  )
}