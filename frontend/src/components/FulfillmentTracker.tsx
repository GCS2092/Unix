import { useTranslation } from "react-i18next"
import { fulfillmentLabelKey, fulfillmentSteps } from "../lib/fulfillment"

interface Props {
  status?: string | null
  method?: string | null
  /** Barres seules (le texte de l'etape en cours est affiche ailleurs) */
  compact?: boolean
}

export default function FulfillmentTracker({ status, method, compact = false }: Props) {
  const { t } = useTranslation()
  const steps = fulfillmentSteps(method)
  const index = steps.findIndex((s) => s === status)
  if (steps.length === 0 || index < 0) return null

  return (
    <ol className={`${compact ? "mt-2.5" : "mt-3"} grid grid-cols-4 gap-1.5`} aria-label={t("fulfillment.title")}>
      {steps.map((step, i) => {
        const done = i <= index
        const current = i === index
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full transition-colors duration-500 ${done ? (index === steps.length - 1 ? "bg-success" : "bg-primary") : "bg-line"}`} />
            {compact ? (
              <span className="sr-only">{t(fulfillmentLabelKey(step, method))}</span>
            ) : (
              <p className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${current ? "font-semibold text-ink" : "text-muted"}`}>
                {t(fulfillmentLabelKey(step, method))}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}