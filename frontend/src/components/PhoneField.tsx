import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, CircleAlert } from "lucide-react"
import {
  COUNTRIES, DEFAULT_COUNTRY, callingCode, composePhone, countryFromValue, exampleFor, nationalFromValue, splitInternational,
  type CountryCode,
} from "../lib/phone"

interface Props {
  label: string
  /** Valeur complete au format +indicatif... (ou vide) */
  value: string
  onChange: (value: string) => void
  error?: string | null
  hint?: string
  forceShow?: boolean
  required?: boolean
  className?: string
}

export function PhoneField({ label, value, onChange, error, hint, forceShow = false, required, className = "" }: Props) {
  const id = useId()
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const lang = fr ? "fr" : "en"
  const [country, setCountry] = useState<CountryCode>(() => countryFromValue(value, DEFAULT_COUNTRY))
  const [text, setText] = useState(() => nationalFromValue(value, countryFromValue(value, DEFAULT_COUNTRY)))
  const [emitted, setEmitted] = useState(value)
  const [touched, setTouched] = useState(false)

  // Valeur changee de l'exterieur (adresse choisie, champ vide) : on resynchronise l'affichage
  if (value !== emitted) {
    const c = countryFromValue(value, country)
    setEmitted(value)
    setCountry(c)
    setText(nationalFromValue(value, c))
  }

  const options = useMemo(() => {
    const dn = new Intl.DisplayNames([lang], { type: "region" })
    const rows = COUNTRIES.map((c) => ({ c, label: `${dn.of(c) ?? c} (+${callingCode(c)})` }))
    return [rows[0], ...rows.slice(1).sort((a, b) => a.label.localeCompare(b.label, lang))]
  }, [lang])

  const example = useMemo(() => exampleFor(country), [country])

  function emit(c: CountryCode, tx: string) {
    const v = composePhone(c, tx)
    setEmitted(v)
    onChange(v)
  }

  function handleText(raw: string) {
    let c = country
    let tx = raw.replace(/[^\d\s+.()-]/g, "")
    const intl = splitInternational(tx)
    if (intl) {
      c = intl.country
      tx = intl.national
    }
    setCountry(c)
    setText(tx)
    emit(c, tx)
  }

  function handleCountry(c: CountryCode) {
    setCountry(c)
    emit(c, text)
  }

  const show = touched || forceShow
  const bad = show && !!error
  const good = show && !error && value !== ""
  const border = bad
    ? "border-danger focus:border-danger focus:ring-danger/20"
    : good
      ? "border-success/60 focus:border-primary focus:ring-primary/20"
      : "border-line focus:border-primary focus:ring-primary/20"
  const example_ = example ? `${fr ? "Ex. :" : "E.g.:"} ${example}` : ""
  const message = bad ? error : [hint, example_].filter(Boolean).join(" · ")

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="mt-1 flex gap-2">
        <select
          aria-label={fr ? "Pays" : "Country"}
          value={country}
          onChange={(e) => handleCountry(e.target.value as CountryCode)}
          className="min-h-[44px] w-40 shrink-0 rounded-lg border border-line bg-surface px-2 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-52"
        >
          {options.map((o) => (
            <option key={o.c} value={o.c}>{o.label}</option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            value={text}
            placeholder={example}
            onChange={(e) => handleText(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={bad}
            aria-describedby={message ? `${id}-msg` : undefined}
            className={`min-h-[44px] w-full rounded-lg border bg-surface px-3 py-2 outline-none transition placeholder:text-muted/60 focus:ring-2 ${border} ${bad || good ? "pr-10" : ""}`}
          />
          {bad && <CircleAlert aria-hidden="true" className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-danger" />}
          {good && <Check aria-hidden="true" strokeWidth={3} className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-success" />}
        </div>
      </div>
      {message && (
        <p id={`${id}-msg`} role={bad ? "alert" : undefined} className={`mt-1 text-xs ${bad ? "text-danger" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  )
}