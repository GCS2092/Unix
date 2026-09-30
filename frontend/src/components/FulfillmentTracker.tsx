import { useTranslation } from "react-i18next"
import { fulfillmentLabelKey, fulfillmentSteps } from "../lib/fulfillment"

interface Props {
  status?: string | null
  method?: string | null
}

export default function FulfillmentTracker({ status, method }: Props) {
  const { t } = useTranslation()
  const steps = fulfillmentSteps(method)
  const index = steps.findIndex((s) => s === status)
  if (steps.length === 0 || index < 0) return null

  return (
    <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label={t("fulfillment.title")}>
      {steps.map((step, i) => {
        const done = i <= index
        const current = i === index
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done ? "bg-primary" : "bg-line"}`} />
            <p className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${current ? "font-semibold text-ink" : "text-muted"}`}>
              {t(fulfillmentLabelKey(step, method))}
            </p>
          </li>
        )
      })}
    </ol>
  )
}