import { getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max"
import examples from "libphonenumber-js/mobile/examples"

export type { CountryCode }

export const DEFAULT_COUNTRY: CountryCode = "SN"

// Pays proposes dans la liste. Pour en ajouter un, ajoute son code ISO ici (ex. "KE").
export const COUNTRIES: CountryCode[] = [
  "SN", "CI", "ML", "BF", "NE", "TG", "BJ", "GN", "GW", "MR", "GM", "CM", "GA", "CG", "CD",
  "MA", "DZ", "TN", "EG", "NG", "GH",
  "FR", "BE", "CH", "LU", "DE", "ES", "IT", "PT", "NL", "GB",
  "CA", "US", "BR", "AE", "SA", "QA", "TR", "LB", "CN",
]

export const callingCode = (c: CountryCode) => getCountryCallingCode(c)

export const exampleFor = (c: CountryCode) => getExampleNumber(c, examples)?.formatNational() ?? ""

function parse(v: string, country?: CountryCode) {
  let t = v.trim()
  if (t.startsWith("00")) t = "+" + t.slice(2)
  if (!t) return undefined
  return parsePhoneNumberFromString(t, t.startsWith("+") ? undefined : (country ?? DEFAULT_COUNTRY))
}

export function isPhone(v: string): boolean {
  return parse(v)?.isValid() ?? false
}

// Format envoye au serveur : +221771234567
export function normalizePhone(v: string): string {
  const p = parse(v)
  return p?.isValid() ? p.number : v.trim()
}

// Numero international colle dans le champ : on en deduit le pays
export function splitInternational(text: string): { country: CountryCode; national: string } | null {
  const t = text.trim()
  if (!t.startsWith("+")) return null
  const p = parsePhoneNumberFromString(t)
  if (!p?.isValid() || !p.country || !COUNTRIES.includes(p.country)) return null
  return { country: p.country, national: p.formatNational() }
}

// Pays + saisie nationale -> valeur complete "+indicatif..."
export function composePhone(country: CountryCode, text: string): string {
  const t = text.trim()
  const digits = t.replace(/\D/g, "")
  if (!digits) return ""
  if (t.startsWith("+")) return "+" + digits
  const p = parsePhoneNumberFromString(t, country)
  if (p?.isValid()) return p.number
  return "+" + callingCode(country) + digits.replace(/^0+/, "")
}

// Valeur complete -> pays (pour l'affichage, par ex. adresse enregistree)
export function countryFromValue(value: string, current: CountryCode): CountryCode {
  const t = value.trim()
  if (!t.startsWith("+")) return current
  const p = parsePhoneNumberFromString(t)
  if (p?.country && COUNTRIES.includes(p.country)) return p.country
  const digits = t.replace(/\D/g, "")
  const matches = COUNTRIES.filter((c) => digits.startsWith(callingCode(c)))
  if (matches.length === 0 || matches.includes(current)) return current
  return matches.sort((a, b) => callingCode(b).length - callingCode(a).length)[0]
}

// Valeur complete -> partie nationale affichee dans le champ
export function nationalFromValue(value: string, country: CountryCode): string {
  const t = value.trim()
  if (!t) return ""
  if (!t.startsWith("+")) return t
  const p = parsePhoneNumberFromString(t)
  if (p?.isValid()) return p.formatNational()
  const digits = t.replace(/\D/g, "")
  const dial = callingCode(country)
  return digits.startsWith(dial) ? digits.slice(dial.length) : digits
}