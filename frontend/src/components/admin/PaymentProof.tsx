import { useEffect, useState } from "react"
import { apiClient } from "../../api/client"

/** Affiche la capture d'un paiement declare. Chargee avec le jeton de l'admin, jamais par une URL publique. */
export default function PaymentProof({ orderId }: { orderId: number }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let objectUrl: string | null = null
    apiClient
      .get<Blob>(`/admin/payments/${orderId}/proof`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, orderId])

  function show() {
    setUrl(null)
    setFailed(false)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setUrl(null)
    setFailed(false)
  }

  return (
    <>
      <button type="button" onClick={show} className="text-xs font-semibold text-primary hover:underline">
        {"Voir la capture jointe"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Capture du paiement" onClick={close}>
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-card border border-line bg-surface p-3 shadow-card-lg" onClick={(e) => e.stopPropagation()}>
            {!url && !failed && <p className="py-8 text-center text-muted">{"Chargement\u2026"}</p>}
            {failed && <p role="alert" className="py-8 text-center text-danger">{"Capture introuvable ou d\u00e9j\u00e0 supprim\u00e9e."}</p>}
            {url && <img src={url} alt="Capture du paiement" className="max-h-[75vh] w-full object-contain" />}
            <button type="button" onClick={close} className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-line text-sm font-semibold hover:bg-page">
              {"Fermer"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}