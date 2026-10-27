import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Check, Clock, Copy, MessageCircle } from "lucide-react"
import { ordersApi } from "../api/orders"
import { formatPrice } from "../lib/format"
import { getErrorMessage } from "../lib/errors"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"
import { toast } from "../stores/toastStore"
import Button from "./Button"
import type { Order } from "../types"

type MethodKey = "wave" | "orange_money" | "free_money" | "transfer"

const METHODS: { key: MethodKey; fr: string; en: string }[] = [
  { key: "wave", fr: "Wave", en: "Wave" },
  { key: "orange_money", fr: "Orange Money", en: "Orange Money" },
  { key: "free_money", fr: "Free Money", en: "Free Money" },
  { key: "transfer", fr: "Virement", en: "Bank transfer" },
]

const card = "rounded-card border border-line bg-surface p-4 shadow-card"
const field = "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

function CopyButton({ value, fr }: { value: string; fr: boolean }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      /* presse-papiers indisponible */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? (fr ? "Copi\u00e9" : "Copied") : fr ? "Copier" : "Copy"}
    </button>
  )
}

export default function ManualPaymentPanel({ order, guestToken }: { order: Order; guestToken?: string }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [txRef, setTxRef] = useState("")
  const [method, setMethod] = useState<MethodKey | "">("")
  const [last4, setLast4] = useState("")
  const [proof, setProof] = useState<File | null>(null)
  const [proofErr, setProofErr] = useState("")

  const info = order.payment_instructions
  const reference = order.public_ref ?? `#${order.id}`
  const amount = formatPrice(order.total, order.currency)
  const claimed = !!order.payment_claimed_at
  const methods = info ? METHODS.filter((m) => info[m.key]) : []
  const note = info ? (fr ? info.note_fr : info.note_en) : ""
  const wa = (info?.whatsapp || WHATSAPP_NUMBER || "").replace(/\D/g, "")
  const waBase = L(`Bonjour, je viens de payer la commande ${reference} (${amount}).`, `Hello, I just paid order ${reference} (${amount}).`)

  const methodLabel = METHODS.find((m) => m.key === method)?.fr ?? ""
  const claimRef = txRef.trim()
  const waExtra = [
    methodLabel && L(`Moyen : ${methodLabel}`, `Method: ${methodLabel}`),
    txRef.trim() && L(`N° de transaction : ${txRef.trim()}`, `Transaction no.: ${txRef.trim()}`),
  last4 && L(`Num\u00e9ro finissant par ${last4}`, `Number ending in ${last4}`),
  ].filter(Boolean).join(" | ")
  const waText = waExtra ? `${waBase} ${waExtra}` : waBase

  const declare = useMutation({
    mutationFn: () => {
      const extra = { method: method || undefined, sender_last4: last4 || undefined, proof: proof ?? undefined }
      return guestToken ? ordersApi.declareTracked(guestToken, claimRef, extra) : ordersApi.declarePayment(order.id, claimRef, extra)
    },
    onSuccess: () => {
      toast.success(L("Merci, nous v\u00e9rifions votre paiement.", "Thank you, we are checking your payment."))
      setProof(null)
      void qc.invalidateQueries({ queryKey: ["order"] })
      void qc.invalidateQueries({ queryKey: ["track"] })
      void qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <section data-tour="od-pay" className={`${card} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold">{L("Payer cette commande", "Pay this order")}</h2>
        <p className="mt-1 text-sm text-muted">
          {L("Envoyez le montant exact par l'un des moyens ci-dessous, en indiquant la r\u00e9f\u00e9rence de la commande.", "Send the exact amount with one of the methods below, quoting the order reference.")}
        </p>
      </div>

      {claimed && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{L("Paiement en cours de v\u00e9rification. Votre commande est conserv\u00e9e, nous la validons d\u00e8s que le paiement est constat\u00e9.", "Payment being verified. Your order is kept and will be confirmed as soon as the payment is seen.")}</span>
        </p>
      )}
      {order.status === "failed" && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {L("La r\u00e9servation du stock a expir\u00e9. Si vous avez pay\u00e9, d\u00e9clarez-le : nous validerons la commande selon le stock disponible.", "The stock reservation expired. If you already paid, declare it: we will confirm the order depending on stock.")}
        </p>
      )}

      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{L("Montant \u00e0 envoyer", "Amount to send")}</dt>
          <dd className="text-lg font-bold text-primary">{amount}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{L("R\u00e9f\u00e9rence \u00e0 indiquer", "Reference to quote")}</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono font-semibold">{reference}</span>
            <CopyButton value={reference} fr={fr} />
          </dd>
        </div>
        {methods.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted">{fr ? m.fr : m.en}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 break-words text-right font-semibold">{info?.[m.key]}</span>
              <CopyButton value={info?.[m.key] ?? ""} fr={fr} />
            </dd>
          </div>
        ))}
      </dl>

      {methods.length === 0 && (
        <p className="rounded-lg bg-page px-3 py-2 text-sm text-muted">
          {L("Contactez-nous pour obtenir les coordonn\u00e9es de paiement.", "Contact us to get the payment details.")}
        </p>
      )}
      {note && <p className="whitespace-pre-line rounded-lg bg-page px-3 py-2 text-sm">{note}</p>}

      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>{L(`Envoyez ${amount} par l'un des moyens ci-dessus.`, `Send ${amount} with one of the methods above.`)}</li>
        <li>{L(`Indiquez ${reference} dans le message du transfert.`, `Quote ${reference} in the transfer message.`)}</li>
        <li>{L("Touchez \u00ab J'ai pay\u00e9 \u00bb : nous v\u00e9rifions puis confirmons votre commande.", "Tap \"I have paid\": we verify and confirm your order.")}</li>
      </ol>

      <div className="space-y-3 border-t border-line pt-4">
        {methods.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{L("Moyen de paiement utilisé", "Payment method used")} <span className="text-danger">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={method === m.key}
                  onClick={() => setMethod(m.key)}
                  className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold transition ${method === m.key ? "border-primary bg-primary text-white" : "border-line bg-surface hover:border-primary"}`}
                >
                  {fr ? m.fr : m.en}
                </button>
              ))}
            </div>
            {!method && <p className="text-xs text-muted">{L("Choisissez le moyen avec lequel vous avez payé pour continuer.", "Choose the method you paid with to continue.")}</p>}
          </fieldset>
        )}
        <label className="block text-sm font-medium">
          {L("Num\u00e9ro de transaction (facultatif)", "Transaction number (optional)")}
          <input className={field} value={txRef} maxLength={100} onChange={(e) => setTxRef(e.target.value)} disabled={declare.isPending} />
        </label>
        <label className="block text-sm font-medium">
          {L("4 derniers chiffres du num\u00e9ro qui a pay\u00e9 (facultatif)", "Last 4 digits of the paying number (optional)")}
          <input className={field} value={last4} inputMode="numeric" maxLength={4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} disabled={declare.isPending} />
        </label>
        <div className="space-y-1">
          <span className="block text-sm font-medium">{L("Capture d'\u00e9cran du paiement (facultatif)", "Payment screenshot (optional)")}</span>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-sm hover:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="min-w-0 truncate">{proof ? proof.name : L("Choisir une image (JPG, PNG, WebP, 3 Mo max)", "Choose an image (JPG, PNG, WebP, 3 MB max)")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={declare.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ""
                if (f && f.size > 3 * 1024 * 1024) { setProofErr(L("Image trop lourde (3 Mo maximum).", "Image too large (3 MB max).")); return }
                setProofErr("")
                setProof(f)
              }}
            />
          </label>
          {proof && <button type="button" onClick={() => setProof(null)} className="text-xs font-semibold text-primary hover:underline">{L("Retirer l'image", "Remove image")}</button>}
          {proofErr && <p role="alert" className="text-xs text-danger">{proofErr}</p>}
          {!proof && (order as unknown as { payment_proof_sent?: boolean }).payment_proof_sent && <p className="text-xs text-muted">{L("Une capture est d\u00e9j\u00e0 enregistr\u00e9e. En choisir une autre la remplace.", "A screenshot is already saved. Choosing another replaces it.")}</p>}
          <p className="text-xs text-muted">{L("Masquez ce qui n'est pas utile (solde, autres op\u00e9rations). La capture n'est visible que par notre \u00e9quipe et supprim\u00e9e automatiquement apr\u00e8s un d\u00e9lai.", "Hide anything unnecessary (balance, other transactions). Only our team can see it, and it is deleted automatically after a while.")}</p>
        </div>
        <Button className="w-full" size="lg" loading={declare.isPending} disabled={methods.length > 0 && !method} onClick={() => declare.mutate()}>
          {claimed ? L("Mettre \u00e0 jour ma d\u00e9claration", "Update my declaration") : L("J'ai pay\u00e9", "I have paid")}
        </Button>
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold hover:bg-page"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {L("Envoyer la preuve par WhatsApp", "Send proof on WhatsApp")}
          </a>
        )}
      </div>
    </section>
  )
}