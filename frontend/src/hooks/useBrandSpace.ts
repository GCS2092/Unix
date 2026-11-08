import { useEffect } from "react"
import { useInRouterContext, useLocation } from "react-router-dom"
import { explicitSpaceOf, type BrandSpace } from "../lib/logoConfig"
import { accountKind } from "../lib/accountKind"
import { useAuthStore } from "../stores/authStore"

const KEY = "brand-space"
let last: BrandSpace | null = null

function remembered(): BrandSpace {
  if (last) return last
  try {
    const v = sessionStorage.getItem(KEY)
    if (v === "shop" || v === "formation") last = v
  } catch { /* stockage indisponible */ }
  return last ?? "shop"
}

function useRouterPath(): string {
  const inRouter = useInRouterContext()
  // Valeur constante pour un composant donne : il ne change pas de contexte en cours de vie
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return inRouter ? useLocation().pathname : window.location.pathname
}

/**
 * Espace affiche. Une adresse de la boutique ou de la formation impose sa marque.
 * Sur une page commune : compte formation seul -> IGA, compte boutique seul -> BETCC,
 * les deux (ou visiteur) -> derniere marque visitee dans l'onglet.
 */
export default function useBrandSpace(): BrandSpace {
  const path = useRouterPath()
  const kind = accountKind(useAuthStore((s) => s.user))
  const explicit = explicitSpaceOf(path)
  const persist = explicit === "shop" || explicit === "formation" ? explicit : null
  useEffect(() => {
    if (!persist) return
    last = persist
    try { sessionStorage.setItem(KEY, persist) } catch { /* stockage indisponible */ }
  }, [persist])
  if (explicit) return explicit
  if (kind === "formation") return "formation"
  if (kind === "shop") return "shop"
  return remembered()
}