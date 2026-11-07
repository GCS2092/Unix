import { useInRouterContext, useLocation } from "react-router-dom"
import { brandSpaceOf, type BrandSpace } from "../lib/logoConfig"

function useRouterPath(): string {
  const inRouter = useInRouterContext()
  // Valeur constante pour un composant donne : il ne change pas de contexte en cours de vie
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return inRouter ? useLocation().pathname : window.location.pathname
}

/** Espace affiche : boutique (BETCC), formation (IGA) ou systeme (neutre). */
export default function useBrandSpace(): BrandSpace {
  return brandSpaceOf(useRouterPath())
}