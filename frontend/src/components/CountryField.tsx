import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { COUNTRIES, countryName, type CountryCode } from "../lib/phone"
import { inputCls } from "./Field"

interface Props {
  label: string
  value: CountryCode
  onChange: (value: CountryCode) => void
  className?: string
}

export function CountryField({ label, value, onChange, className = "" }: Props) {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith("en") ? "en" : "fr"
  const options = useMemo(() => {
    const rows = COUNTRIES.map((c) => ({ c, label: countryName(c, lang) }))
    return [rows[0], ...rows.slice(1).sort((a, b) => a.label.localeCompare(b.label, lang))]
  }, [lang])

  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as CountryCode)} className={inputCls}>
        {options.map((o) => (
          <option key={o.c} value={o.c}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}