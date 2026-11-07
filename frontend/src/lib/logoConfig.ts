// Logos et noms de marque : BETCC (boutique) et IGA (formation). Fichiers dans frontend/public.
export const LOGO_SRC: string = "/logo-betcc-horizontal.svg"
export const LOGO_HAS_NAME: boolean = true
export const FORMATION_NAME = "IGA"
export const FORMATION_LOGO_SRC: string = "/logo-iga.svg"
export const FORMATION_LOGO_HAS_NAME: boolean = true

export type BrandSpace = "shop" | "formation" | "system"

// Pages de la formation : le reste est la boutique, sauf l'espace Systeme (neutre)
const FORMATION_PREFIXES = ["/etudiant", "/admin/formation", "/formations", "/decouvrir/formations", "/rejoindre", "/verification", "/mes-cours", "/reunions", "/c"]

export function brandSpaceOf(pathname: string): BrandSpace {
  if (pathname === "/admin/systeme" || pathname.startsWith("/admin/systeme/")) return "system"
  return FORMATION_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ? "formation" : "shop"
}