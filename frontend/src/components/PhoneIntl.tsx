import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min"

interface Opt { code: string; name: string; dial: string }

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
const flag = (c: string) => c.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))

export default function PhoneField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  country: CountryCode
  onCountry: (c: CountryCode) => void
  options: Opt[]
  error?: string
}) {
  const { label, value, onChange, country, onCountry, options, error } = props
  const { t } = useTranslation()
  const uid = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const current = options.find((o) => o.code === country)

  const filtered = useMemo(() => {
    const q = norm(query).replace(/^\+/, "")
    if (!q) return options
    const starts: Opt[] = []
    const contains: Opt[] = []
    for (const o of options) {
      const n = norm(o.name)
      if (n.startsWith(q) || o.dial.startsWith(q) || o.code.toLowerCase() === q) starts.push(o)
      else if (n.includes(q) || o.code.toLowerCase().startsWith(q)) contains.push(o)
    }
    return [...starts, ...contains]
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }) }, [active])

  function close() { setOpen(false); setQuery(""); setActive(0) }

  function pickCountry(o: Opt) {
    const c = o.code as CountryCode
    onCountry(c)
    if (value && !value.startsWith("+")) onChange(new AsYouType(c).input(value.replace(/\D/g, "")))
    close()
  }

  function handleInput(raw: string) {
    if (raw.startsWith("+")) {
      const ayt = new AsYouType()
      const out = ayt.input(raw)
      const c = ayt.getCountry()
      const nn = ayt.getNumber()?.nationalNumber
      if (c && nn && options.some((o) => o.code === c)) {
        onCountry(c)
        onChange(new AsYouType(c).input(String(nn)))
      } else onChange(out)
      return
    }
    // En suppression on ne reformate pas (sinon on ne peut pas effacer un espace).
    onChange(raw.length < value.length ? raw.replace(/[^\d]+$/, "") : new AsYouType(country).input(raw))
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) pickCountry(filtered[active]) }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close() }
  }

  const parsed = value.trim() ? parsePhoneNumberFromString(value.trim(), country) : undefined
  const valid = !!parsed?.isValid()

  return (
    <div ref={wrap} className="relative">
      <label className="block text-sm font-medium" htmlFor={`${uid}-tel`}>{label}</label>
      <div
        className={`mt-1 flex min-h-[48px] items-stretch rounded-lg border bg-surface transition focus-within:ring-2 ${
          error ? "border-danger focus-within:border-danger focus-within:ring-danger/20" : "border-line focus-within:border-primary focus-within:ring-primary/20"
        }`}
      >
        <button
          type="button" aria-haspopup="listbox" aria-expanded={open}
          aria-label={t("px.signup.phone_country", { defaultValue: "Indicatif du pays" })}
          onClick={() => (open ? close() : setOpen(true))}
          className="flex shrink-0 items-center gap-1.5 rounded-l-lg border-r border-line px-3 text-sm font-semibold transition hover:bg-black/5"
        >
          <span aria-hidden="true" className="text-lg leading-none">{flag(country)}</span>
          <span>+{current?.dial ?? ""}</span>
          <span aria-hidden="true" className={`text-[10px] text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        <input
          id={`${uid}-tel`} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="77 123 45 67"
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${uid}-err` : undefined}
          value={value} onChange={(e) => handleInput(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        {valid && !error && (
          <span aria-label={t("px.signup.phone_ok", { defaultValue: "Numéro valide" })} className="flex items-center pr-3 text-base font-bold text-success">✓</span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card-lg sm:right-auto sm:w-80">
          <div className="border-b border-line p-2">
            <input
              autoFocus type="search" value={query} autoComplete="off" spellCheck={false}
              placeholder={t("px.signup.phone_search", { defaultValue: "Rechercher un pays ou un indicatif" })}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onSearchKey}
              className="min-h-[40px] w-full rounded-lg border border-line bg-page px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-auto py-1 text-sm">
            {filtered.length === 0 && <li className="px-3 py-3 text-muted">{t("px.signup.no_result", { defaultValue: "Aucun résultat" })}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.code} role="option" aria-selected={o.code === country}
                onMouseMove={() => { if (active !== i) setActive(i) }}
                onClick={() => pickCountry(o)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${i === active ? "bg-primary/10" : ""} ${o.code === country ? "font-semibold text-primary" : ""}`}
              >
                <span aria-hidden="true" className="text-lg leading-none">{flag(o.code)}</span>
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <span className="shrink-0 text-xs text-muted">+{o.dial}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error ? (
        <p id={`${uid}-err`} className="mt-1 text-xs text-danger">{error}</p>
      ) : valid && parsed ? (
        <p className="mt-1 text-xs text-muted">{t("px.signup.phone_saved", { defaultValue: "Numéro enregistré :" })} {parsed.number}</p>
      ) : (
        <p className="mt-1 text-xs text-muted">{t("px.signup.phone_help", { defaultValue: "Sans le 0 initial. Vous pouvez aussi coller un numéro au format +221…" })}</p>
      )}
    </div>
  )
}