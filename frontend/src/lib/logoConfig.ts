// Logos et noms de marque : BETCC (boutique) et IGA (formation). Fichiers dans frontend/public.
export const LOGO_SRC: string = "/logo-betcc-horizontal.svg"
export const LOGO_HAS_NAME: boolean = true
export const FORMATION_NAME = "IGA"
export const FORMATION_LOGO_SRC: string = "/logo-iga.svg"
export const FORMATION_LOGO_HAS_NAME: boolean = true

export type BrandSpace = "shop" | "formation" | "system"

// Adresses de la formation : le reste est la boutique, sauf l'espace Systeme (neutre)
const FORMATION_PREFIXES = ["/etudiant", "/admin/formation", "/formations", "/decouvrir/formations", "/rejoindre", "/verification", "/mes-cours", "/reunions", "/c"]
// Pages communes aux deux marques (routes reelles de App.tsx) : elles gardent la marque du compte ou de l'espace d'origine
const NEUTRAL_PREFIXES = ["/connexion", "/inscription", "/mot-de-passe", "/compte"]
const NEUTRAL_EXACT = ["/decouvrir", "/admin", "/admin/connexion"]

export function brandSpaceOf(pathname: string): BrandSpace {
  if (pathname === "/admin/systeme" || pathname.startsWith("/admin/systeme/")) return "system"
  return FORMATION_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ? "formation" : "shop"
}

/** Espace impose par l'adresse, ou null pour une page commune. */
export function explicitSpaceOf(pathname: string): BrandSpace | null {
  if (NEUTRAL_EXACT.includes(pathname)) return null
  if (NEUTRAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null
  return brandSpaceOf(pathname)
}