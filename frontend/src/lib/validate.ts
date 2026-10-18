import i18n from "i18next"
import { isPhone, normalizePhone } from "./phone"

export { isPhone, normalizePhone }

const fr = () => (i18n.language ?? "fr").startsWith("fr")
const tr = (f: string, e: string) => (fr() ? f : e)

export const msg = {
  name: () => tr("Nom invalide : lettres uniquement, 2 minimum", "Invalid name: letters only, 2 minimum"),
  phone: () => tr("Numéro invalide pour le pays sélectionné", "Invalid number for the selected country"),
  email: () => tr("Email invalide", "Invalid email"),
  password: () => tr("Mot de passe : 8 caractères minimum", "Password: 8 characters minimum"),
  mismatch: () => tr("Les mots de passe ne correspondent pas", "Passwords do not match"),
  city: () => tr("Ville invalide", "Invalid city"),
  address: () => tr("Adresse trop courte ou invalide", "Address too short or invalid"),
  didYouMean: () => tr("Vouliez-vous dire", "Did you mean"),
}

export const isEmail = (v: string) => {
  const t = v.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) && !t.includes("..") && !t.startsWith(".") && !/\.@|@\./.test(t)
}

export const phoneDigits = (v: string) => v.replace(/\D/g, "")

export const hasLetters = (v: string) => (v.match(/\p{L}/gu)?.length ?? 0) >= 2

export const isName = (v: string) => {
  const t = v.trim()
  return t.length >= 2 && t.length <= 120 && hasLetters(t) && /^\p{L}[\p{L}\p{M}\s'’.-]*$/u.test(t)
}

const DOMAINS = ["gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.fr", "icloud.com", "orange.sn", "free.fr"]

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// "jean@gmial.com" -> "jean@gmail.com" ; null si rien a suggerer
export function suggestEmail(v: string): string | null {
  const t = v.trim()
  const at = t.lastIndexOf("@")
  if (at < 1) return null
  const domain = t.slice(at + 1).toLowerCase()
  if (domain.length < 6 || DOMAINS.includes(domain)) return null
  const max = domain.length >= 8 ? 2 : 1
  let best: string | null = null
  let bestDist = max + 1
  for (const d of DOMAINS) {
    const dist = lev(domain, d)
    if (dist <= max && dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  return best ? t.slice(0, at + 1) + best : null
}