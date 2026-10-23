import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import type { CountryOption } from "../lib/geo"

interface Opt { key: string; value: string; label: string; sub?: string; divider?: boolean }

/** Compare sans accents ni majuscules. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

function Autocomplete(props: {
  label: string
  text: string
  onText: (v: string) => void
  options: Opt[]
  onPick: (o: Opt) => void
  onCommit?: () => void
  error?: string
  placeholder?: string
  busy?: boolean
  chevron?: boolean
  firstActive?: boolean
  emptyText?: string
}) {
  const { label, text, onText, options, onPick, onCommit, error, placeholder, busy, chevron, firstActive, emptyText } = props
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open && active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  function pick(o: Opt) {
    onPick(o)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      if (open && active >= 0 && options[active]) {
        e.preventDefault()
        pick(options[active])
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  const showList = open && (options.length > 0 || !!emptyText)

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={`${uid}-in`}>{label}</label>
      <div className="relative mt-1">
        <input
          id={`${uid}-in`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => { onText(e.target.value); setOpen(true); setActive(firstActive ? 0 : -1) }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => { setOpen(false); setActive(-1); onCommit?.() }}
          onKeyDown={onKeyDown}
          className={`min-h-[44px] w-full rounded-lg border bg-surface px-3 py-2 pr-9 text-sm outline-none transition focus:ring-2 ${
            error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-line focus:border-primary focus:ring-primary/20"
          }`}
        />
        {busy ? (
          <span aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-primary" />
        ) : chevron ? (
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">▾</span>
        ) : null}
        {showList && (
          <ul
            id={`${uid}-list`} role="listbox" ref={listRef}
            className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface py-1 text-sm shadow-card-lg"
          >
            {options.length === 0 && <li className="px-3 py-2.5 text-muted">{emptyText}</li>}
            {options.map((o, i) => (
              <li
                key={o.key} id={`${uid}-o${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => { if (active !== i) setActive(i) }}
                onClick={() => pick(o)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 ${o.divider ? "border-t border-line" : ""} ${i === active ? "bg-primary/10 text-primary" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="shrink-0 truncate text-xs text-muted">{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p id={`${uid}-err`} className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export function CountrySelect(props: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
  countries: { top: CountryOption[]; all: CountryOption[] }
}) {
  const { label, placeholder, value, onChange, error, countries } = props
  const { t } = useTranslation()
  const byCode = useMemo(() => new Map([...countries.top, ...countries.all].map((c) => [c.code, c.name])), [countries])
  const selectedName = byCode.get(value) ?? ""
  const [text, setText] = useState(selectedName)
  const [typing, setTyping] = useState(false)

  // Resynchronise quand la valeur change de l'exterieur (pre-remplissage, langue...).
  useEffect(() => { setText(selectedName); setTyping(false) }, [selectedName])

  const options = useMemo<Opt[]>(() => {
    const q = typing ? norm(text) : ""
    if (!q) {
      const topCodes = new Set(countries.top.map((c) => c.code))
      return [
        ...countries.top.map((c) => ({ key: `t-${c.code}`, value: c.code, label: c.name })),
        ...countries.all.filter((c) => !topCodes.has(c.code)).map((c, i) => ({ key: c.code, value: c.code, label: c.name, divider: i === 0 })),
      ]
    }
    const starts: Opt[] = []
    const contains: Opt[] = []
    for (const c of countries.all) {
      const n = norm(c.name)
      const o = { key: c.code, value: c.code, label: c.name }
      if (n.startsWith(q)) starts.push(o)
      else if (n.includes(q)) contains.push(o)
    }
    return [...starts, ...contains]
  }, [countries, text, typing])

  function commit() {
    if (!typing) return
    const q = norm(text)
    const exact = countries.all.find((c) => norm(c.name) === q)
    const only = options.length === 1 ? options[0] : undefined
    if (exact) { onChange(exact.code); setText(exact.name) }
    else if (only) { onChange(only.value); setText(only.label) }
    else setText(selectedName)
    setTyping(false)
  }

  return (
    <Autocomplete
      label={label} placeholder={placeholder} text={text} options={options} error={error} chevron firstActive
      emptyText={t("px.signup.no_result", { defaultValue: "Aucun résultat" })}
      onText={(v) => { setText(v); setTyping(true); if (!v.trim()) onChange("") }}
      onPick={(o) => { onChange(o.value); setText(o.label); setTyping(false) }}
      onCommit={commit}
    />
  )
}

const CACHE = new Map<string, Opt[]>()

/** Suggestions de villes via Open-Meteo (anti-rebond, annulation, cache). Echec silencieux. */
function useRemoteCities(query: string, country: string, lang: string, enabled: boolean) {
  const q = query.trim()
  const key = `${lang}|${country}|${norm(q)}`
  const [items, setItems] = useState<Opt[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!enabled || q.length < 2) { setBusy(false); return }
    const hit = CACHE.get(key)
    if (hit) { setItems(hit); setBusy(false); return }
    const ctrl = new AbortController()
    setBusy(true)
    const timer = window.setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ name: q, count: "8", language: lang, format: "json" })
        if (country) qs.set("countryCode", country)
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${qs.toString()}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { results?: { id: number; name: string; admin1?: string; country?: string }[] }
        const list: Opt[] = (json.results ?? []).map((r) => ({
          key: `r-${r.id}`,
          value: r.name,
          label: r.name,
          sub: [r.admin1, country ? "" : r.country].filter(Boolean).join(", ") || undefined,
        }))
        CACHE.set(key, list)
        setItems(list)
      } catch {
        // Hors ligne, quota, abandon : on garde la liste locale et la saisie libre.
      } finally {
        if (!ctrl.signal.aborted) setBusy(false)
      }
    }, 300)
    return () => { window.clearTimeout(timer); ctrl.abort() }
  }, [enabled, q, key, country, lang])

  return { items: enabled && q.length >= 2 ? items : [], busy }
}

export function CityInput(props: {
  id?: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  cities: string[]
  country?: string
}) {
  const { label, value, onChange, error, cities, country } = props
  const { i18n } = useTranslation()
  const lang = (i18n.language || "fr").slice(0, 2)
  const [typing, setTyping] = useState(false)
  const remote = useRemoteCities(value, country ?? "", lang, typing)

  const options = useMemo<Opt[]>(() => {
    const q = norm(value)
    const starts: string[] = []
    const contains: string[] = []
    for (const c of cities) {
      const n = norm(c)
      if (!q || n.startsWith(q)) starts.push(c)
      else if (n.includes(q)) contains.push(c)
    }
    const local: Opt[] = [...starts, ...contains].slice(0, q ? 6 : 8).map((c) => ({ key: `l-${c}`, value: c, label: c }))
    const seen = new Set(local.map((o) => norm(o.label)))
    return [...local, ...remote.items.filter((o) => !seen.has(norm(o.label)))]
  }, [cities, value, remote.items])

  return (
    <Autocomplete
      label={label} text={value} options={options} error={error} busy={remote.busy}
      onText={(v) => { onChange(v); setTyping(true) }}
      onPick={(o) => { onChange(o.value); setTyping(false) }}
      onCommit={() => {
        setTyping(false)
        const clean = value.replace(/\s+/g, " ").trim()
        if (clean !== value) onChange(clean)
      }}
    />
  )
}