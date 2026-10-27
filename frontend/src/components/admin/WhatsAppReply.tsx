import { useState } from "react"
import { formatPrice } from "../../lib/format"
import { toast } from "../../stores/toastStore"

export interface ReplyTarget {
  id: number
  public_ref?: string | null
  customer?: string | null
  phone?: string | null
  total: number
  currency?: string
  status?: string
  locale?: string | null
}

type Kind = "received" | "notfound" | "amount" | "info"
type Lang = "fr" | "en"

const KINDS: { key: Kind; label: string }[] = [
  { key: "received", label: "Paiement re\u00e7u, commande confirm\u00e9e" },
  { key: "notfound", label: "Paiement introuvable" },
  { key: "amount", label: "Montant \u00e0 v\u00e9rifier" },
  { key: "info", label: "Demander une preuve" },
]

function buildMessage(kind: Kind, lang: Lang, name: string, ref: string, amount: string): string {
  const fr = lang === "fr"
  const hi = name ? (fr ? `Bonjour ${name}` : `Hello ${name}`) : fr ? "Bonjour" : "Hello"
  switch (kind) {
    case "received":
      return fr
        ? `${hi}, nous avons bien re\u00e7u votre paiement de ${amount} pour la commande ${ref}. Votre commande est confirm\u00e9e, nous la pr\u00e9parons. Merci pour votre confiance !`
        : `${hi}, we have received your payment of ${amount} for order ${ref}. Your order is confirmed and we are preparing it. Thank you for your trust!`
    case "notfound":
      return fr
        ? `${hi}, nous n'avons pas encore retrouv\u00e9 votre paiement de ${amount} pour la commande ${ref}. Pouvez-vous nous envoyer la capture du paiement ou le num\u00e9ro de transaction ? Merci.`
        : `${hi}, we have not found your payment of ${amount} for order ${ref} yet. Could you send us the payment screenshot or the transaction number? Thank you.`
    case "amount":
      return fr
        ? `${hi}, le montant re\u00e7u pour la commande ${ref} ne correspond pas au total de ${amount}. Pouvez-vous v\u00e9rifier votre paiement et nous envoyer la capture ? Merci.`
        : `${hi}, the amount received for order ${ref} does not match the total of ${amount}. Could you check your payment and send us the screenshot? Thank you.`
    default:
      return fr
        ? `${hi}, pour valider la commande ${ref} (${amount}), merci de nous envoyer la capture du paiement ou le num\u00e9ro de transaction.`
        : `${hi}, to confirm order ${ref} (${amount}), please send us the payment screenshot or the transaction number.`
  }
}

/** Numero au format wa.me : chiffres uniquement, avec indicatif (221 par defaut pour un numero local a 9 chiffres). */
function waNumber(phone?: string | null): string {
  const raw = (phone ?? "").trim()
  if (!raw) return ""
  const d = raw.replace(/\D/g, "")
  if (raw.startsWith("+")) return d
  if (d.startsWith("00")) return d.slice(2)
  if (d.length === 9) return "221" + d
  return d
}

export default function WhatsAppReply({ order }: { order: ReplyTarget }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>(order.status === "paid" ? "received" : "info")
  const [lang, setLang] = useState<Lang>((order.locale ?? "fr").toLowerCase().startsWith("en") ? "en" : "fr")
  const [edited, setEdited] = useState<string | null>(null)

  const ref = order.public_ref ?? `#${order.id}`
  const amount = formatPrice(order.total, order.currency)
  const generated = buildMessage(kind, lang, (order.customer ?? "").trim(), ref, amount)
  const text = edited ?? generated
  const num = waNumber(order.phone)

  function openWhatsApp() {
    if (!num) return
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Message copi\u00e9.")
    } catch {
      toast.error("Copie impossible : s\u00e9lectionne le texte et copie-le \u00e0 la main.")
    }
  }

  const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[36px] items-center rounded-lg border border-line px-3 text-sm font-semibold hover:bg-page"
      >
        {"R\u00e9pondre par WhatsApp"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="R\u00e9ponse WhatsApp"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-card border border-line bg-surface p-5 shadow-card-lg sm:max-w-md sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">{"R\u00e9pondre au client"}</h2>
            <p className="mt-1 text-sm text-muted">
              {`${order.customer ?? "Client"} \u00b7 ${ref} \u00b7 ${amount}`}
            </p>

            <label className="mt-4 block text-sm font-medium">
              {"Mod\u00e8le de message"}
              <select className={field} value={kind} onChange={(e) => { setKind(e.target.value as Kind); setEdited(null) }}>
                {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>

            <div className="mt-3 flex gap-2" role="group" aria-label="Langue du message">
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => { setLang(l); setEdited(null) }}
                  className={`min-h-[36px] rounded-full border px-4 text-sm font-semibold ${lang === l ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:border-primary/40"}`}
                >
                  {l === "fr" ? "Fran\u00e7ais" : "English"}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-sm font-medium">
              {"Message (modifiable)"}
              <textarea className={field} rows={6} value={text} maxLength={1000} onChange={(e) => setEdited(e.target.value)} />
            </label>

            {!num && (
              <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {"Aucun num\u00e9ro de t\u00e9l\u00e9phone sur cette commande : copie le message et envoie-le par un autre canal."}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              {"Ne demande jamais de code secret, de code re\u00e7u par SMS ni d'acc\u00e8s au compte Wave ou Orange du client."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setOpen(false)} className="flex min-h-[48px] items-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-page">
                {"Fermer"}
              </button>
              <button type="button" onClick={() => void copy()} className="flex min-h-[48px] items-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-page">
                {"Copier"}
              </button>
              <button
                type="button"
                disabled={!num}
                onClick={openWhatsApp}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {"Ouvrir WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}