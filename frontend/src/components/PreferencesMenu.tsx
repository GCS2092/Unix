import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CURRENCIES } from "../lib/currency"
import { useCurrencyStore } from "../stores/currencyStore"
import Button from "./Button"

const LANGS = [
  { value: "fr", label: "Fran\u00e7ais" },
  { value: "en", label: "English" },
]
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c as string, label: c === "XOF" ? "FCFA" : c }))

interface Option { value: string; label: string }

function OptionGroup({ title, options, value, onChange }: {
  title: string
  options: Option[]
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-1.5 text-xs font-medium text-muted">{title}</p>
      <div className="flex gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={
                "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold transition duration-150 active:scale-[0.97] " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
                (active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "border border-line text-ink hover:bg-page")
              }
            >
              {active && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PreferencesMenu() {
  const { t, i18n } = useTranslation()
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const lang = i18n.language.slice(0, 2)
  const currencyLabel = currency === "XOF" ? "FCFA" : currency

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t("common.language")} / ${t("common.currency")}`}
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink " +
          "transition duration-150 hover:bg-page active:scale-[0.97] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        }
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 010 18a14 14 0 010-18" />
        </svg>
        <span>{`${lang.toUpperCase()} \u00b7 ${currencyLabel}`}</span>
        <svg className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-card border border-line bg-surface p-3 shadow-card"
        >
          <OptionGroup
            title={t("common.language")}
            options={LANGS}
            value={lang}
            onChange={(l) => void i18n.changeLanguage(l)}
          />
          <OptionGroup
            title={t("common.currency")}
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={setCurrency}
          />
          <Button variant="secondary" full onClick={() => setOpen(false)}>{t("common.close")}</Button>
        </div>
      )}
    </div>
  )
}