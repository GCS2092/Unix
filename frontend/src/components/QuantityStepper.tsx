import { useTranslation } from "react-i18next"

const btn =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-line transition hover:bg-page active:scale-95 active:bg-line/60 disabled:opacity-40"

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function QuantityStepper({ value, onChange, max = 99 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t("ux.quantity")}>
      <button type="button" aria-label={t("ux.decrease")} disabled={value <= 1} onClick={() => onChange(value - 1)} className={btn}>
        <Icon d="M5 12h14" />
      </button>
      <span className="w-10 text-center text-lg font-semibold" aria-live="polite">{value}</span>
      <button type="button" aria-label={t("ux.increase")} disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
        <Icon d="M12 5v14M5 12h14" />
      </button>
    </div>
  )
}