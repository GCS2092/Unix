import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CURRENCIES } from "../lib/currency"
import { useCurrencyStore } from "../stores/currencyStore"
import { useTourStore } from "../stores/tourStore"

const LANGS = [
  { value: "fr", code: "FR", label: "Fran\u00e7ais" },
  { value: "en", code: "EN", label: "English" },
]

const symbol = (c: string) => (c === "XOF" ? "FCFA" : c)

function currencyName(code: string, lang: string): string {
  try {
    const n = new Intl.DisplayNames([lang], { type: "currency" }).of(code) ?? code
    return n.charAt(0).toUpperCase() + n.slice(1)
  } catch {
    return code
  }
}

function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export default function PreferencesMenu() {
  const { t, i18n } = useTranslation()
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const restartTour = useTourStore((s) => s.restart)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const lang = i18n.language.slice(0, 2)
  const fr = lang !== "en"

  const currencies = useMemo(
    () => (CURRENCIES as readonly string[]).map((c) => ({ value: c, symbol: symbol(c), name: currencyName(c, lang) })),
    [lang],
  )

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
    // Le focus va sur la langue active pour une navigation clavier immediate
    panelRef.current?.querySelector<HTMLElement>("[data-lang][aria-checked='true']")?.focus()
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const heading = "mb-2 text-xs font-semibold uppercase tracking-wider text-muted"

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={`${t("common.language")} / ${t("common.currency")}`}
        data-tour="prefs"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold text-ink transition duration-150 active:scale-[0.97] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
          (open ? "border-primary/40 bg-primary/5" : "border-line bg-surface hover:bg-page")
        }
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 010 18a14 14 0 010-18" />
        </svg>
        <span>{`${lang.toUpperCase()} \u00b7 ${symbol(currency)}`}</span>
        <svg className={`hidden h-4 w-4 text-muted transition-transform min-[400px]:block ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`${t("common.language")} / ${t("common.currency")}`}
          data-tour-block=""
          className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-card border border-line bg-surface p-4 shadow-card-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-bold">{fr ? "Préférences" : "Preferences"}</p>
            <button
              type="button"
              onClick={() => { setOpen(false); triggerRef.current?.focus() }}
              aria-label={t("common.close")}
              className="-mr-2 grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-page hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <section>
            <p className={heading}>{t("common.language")}</p>
            <div role="radiogroup" aria-label={t("common.language")} className="grid grid-cols-2 gap-2">
              {LANGS.map((l) => {
                const on = l.value === lang
                return (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-lang=""
                    onClick={() => void i18n.changeLanguage(l.value)}
                    className={
                      "relative flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3 text-left transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
                      (on ? "border-primary bg-primary/10 text-primary" : "border-line hover:border-primary/40 hover:bg-page")
                    }
                  >
                    <span className="text-sm font-extrabold tracking-wide">{l.code}</span>
                    <span className="text-xs font-medium opacity-80">{l.label}</span>
                    {on && <Check className="absolute right-2.5 top-2.5 h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="mt-4">
            <p className={heading}>{t("common.currency")}</p>
            <div role="radiogroup" aria-label={t("common.currency")} className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {currencies.map((c) => {
                const on = c.value === currency
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCurrency(c.value)}
                    className={
                      "flex min-h-[48px] w-full items-center justify-between gap-3 px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 " +
                      (on ? "bg-primary/10 font-semibold text-primary" : "hover:bg-page")
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary" : "border-line"}`}>
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-bold ${on ? "text-primary" : "text-muted"}`}>{c.symbol}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <button
            type="button"
            onClick={() => { setOpen(false); restartTour() }}
            className="mt-4 min-h-[40px] w-full rounded-lg text-sm font-semibold text-muted underline-offset-2 transition hover:text-primary hover:underline"
          >
            {t("tour.restart")}
          </button>
        </div>
      )}
    </div>
  )
}