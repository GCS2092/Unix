import { getCountries, getCountryCallingCode } from "libphonenumber-js/min"

export const COUNTRY_CODES = "AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ")

/** Pays proposes en tete des listes. */
const PRIORITY = ["SN", "CI", "ML", "GN", "BF", "BJ", "TG", "CM", "GA", "CG", "CD", "MR", "NE", "MA", "DZ", "TN", "FR", "BE", "CA"]

export const MIN_AGE = 16
export const MAX_AGE = 100

export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u
export const PLACE_RE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s'’.,()/-]*$/u

export type CountryOption = { code: string; name: string }

export function countryOptions(locale: string): { top: CountryOption[]; all: CountryOption[] } {
  const dn = new Intl.DisplayNames([locale], { type: "region" })
  const all: CountryOption[] = COUNTRY_CODES.map((code) => ({ code, name: dn.of(code) ?? code }))
  all.sort((a, b) => a.name.localeCompare(b.name, locale))
  const top = PRIORITY.map((c) => all.find((x) => x.code === c)).filter((x): x is CountryOption => Boolean(x))
  return { top, all }
}

export function phoneOptions(locale: string) {
  const dn = new Intl.DisplayNames([locale], { type: "region" })
  return getCountries()
    .filter((c) => COUNTRY_CODES.includes(c))
    .map((code) => ({ code, name: dn.of(code) ?? code, dial: getCountryCallingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
}

/** Age en annees pour une date AAAA-MM-JJ, ou null si la date est invalide. */
export function ageFrom(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age--
  return age
}

const CITIES: Record<string, string[]> = {
  SN: ["Dakar", "Pikine", "Guédiawaye", "Rufisque", "Thiès", "Touba", "Mbour", "Saint-Louis", "Kaolack", "Ziguinchor", "Diourbel", "Louga", "Tambacounda", "Kolda", "Fatick", "Kaffrine", "Matam", "Sédhiou", "Kédougou"],
  CI: ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Daloa", "Korhogo", "Man"],
  ML: ["Bamako", "Sikasso", "Ségou", "Mopti", "Kayes", "Tombouctou", "Gao"],
  GN: ["Conakry", "Kankan", "Labé", "Nzérékoré", "Kindia"],
  BF: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Banfora"],
  BJ: ["Cotonou", "Porto-Novo", "Parakou", "Abomey-Calavi"],
  TG: ["Lomé", "Sokodé", "Kara", "Atakpamé"],
  CM: ["Douala", "Yaoundé", "Garoua", "Bafoussam", "Bamenda"],
  GA: ["Libreville", "Port-Gentil", "Franceville"],
  CG: ["Brazzaville", "Pointe-Noire"],
  CD: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Goma"],
  MR: ["Nouakchott", "Nouadhibou", "Rosso"],
  NE: ["Niamey", "Zinder", "Maradi"],
  GM: ["Banjul", "Serekunda"],
  GW: ["Bissau"],
  MA: ["Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir"],
  DZ: ["Alger", "Oran", "Constantine"],
  TN: ["Tunis", "Sfax", "Sousse"],
  FR: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Bordeaux", "Lille"],
  BE: ["Bruxelles", "Anvers", "Liège"],
  CA: ["Montréal", "Québec", "Ottawa", "Toronto"],
}

export const citiesFor = (code: string): string[] => CITIES[code] ?? []

const EMAIL_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
}

export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const fix = EMAIL_TYPOS[email.slice(at + 1).trim().toLowerCase()]
  return fix ? `${email.slice(0, at).trim()}@${fix}` : null
}