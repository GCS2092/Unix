import { useTranslation } from "react-i18next"
import { fulfillmentLabelKey, fulfillmentSteps } from "../lib/fulfillment"
import type { Order } from "../types"

// Frise verticale datee : chaque etape atteinte affiche le jour et l'heure ou elle a ete validee
export default function OrderTimeline({ order }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const method = order.delivery_method
  const steps = fulfillmentSteps(method)
  const index = steps.findIndex((s) => s === order.fulfillment_status)
  if (steps.length === 0 || index < 0) return null

  const locale = i18n.language.startsWith("fr") ? "fr-FR" : "en-US"
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  const dateOf = (step: string): string | null => {
    if (step === "received") return order.paid_at ?? order.created_at
    const ev = [...(order.events ?? [])].reverse().find((e) => e.step === step)
    return ev?.at ?? null
  }

  return (
    <ol className="mt-3" aria-label={t("fulfillment.title")}>
      {steps.map((step, i) => {
        const done = i <= index
        const current = i === index
        const at = done ? dateOf(step) : null
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute left-[9px] top-5 h-full w-0.5 ${i < index ? "bg-primary" : "bg-line"}`} />
            )}
            <span
              className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                done ? "border-primary bg-primary text-white" : "border-line bg-surface"
              }`}
            >
              {done && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-sm ${current ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"}`}>
                {t(fulfillmentLabelKey(step, method))}
              </p>
              {at && <p className="text-xs text-muted">{fmt(at)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}