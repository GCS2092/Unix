import CopyButton from "./CopyButton"

type Tone = { bar: string; dot: string }

const TONES: Record<string, Tone> = {
  paid: { bar: "bg-success", dot: "bg-success" },
  pending: { bar: "bg-primary", dot: "bg-primary" },
  failed: { bar: "bg-danger", dot: "bg-danger" },
  cancelled: { bar: "bg-danger", dot: "bg-danger" },
}

// En-tete de la page de suivi : identifiant en grand, statut colore, phrase d'etat
export default function OrderHero({
  title,
  reference,
  date,
  status,
  statusLabel,
  badgeClass,
  fr,
}: {
  title: string
  reference: string | null
  date: string
  status: string
  statusLabel: string
  badgeClass: string
  fr: boolean
}) {
  const tone = TONES[status] ?? TONES.pending

  const sentence =
    status === "paid"
      ? fr ? "Paiement confirm\u00e9. Suivez l'avancement de votre commande ci-dessous." : "Payment confirmed. Follow your order progress below."
      : status === "pending"
        ? fr ? "En attente de paiement." : "Waiting for payment."
        : fr ? "Cette commande n'est plus active." : "This order is no longer active."

  return (
    <div>
      <div className={`-mx-4 -mt-4 mb-4 h-1.5 rounded-t-card ${tone.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{fr ? "Votre commande" : "Your order"}</p>
          <h1 className="mt-1 break-all font-mono text-xl font-bold tracking-wide sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">{date}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">{sentence}</p>
      {reference && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium text-muted">{fr ? "Identifiant" : "Reference"}</span>
          <span className="font-mono text-sm font-semibold tracking-wider">{reference}</span>
          <span className="ml-auto"><CopyButton value={reference} /></span>
        </div>
      )}
    </div>
  )
}