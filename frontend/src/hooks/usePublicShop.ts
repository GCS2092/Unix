import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { shippingApi } from "../api/shipping"

// Infos publiques de la boutique (contact, retrait, horaires, reseaux, regles de commande)
export function usePublicShop() {
  return useQuery({
    queryKey: ["public-shop"],
    queryFn: async () => (await shippingApi.publicShop()).data.data,
    staleTime: 60_000,
  })
}

const BRAND_KEY = "unix.brand"
const DEFAULT_BRAND = "UNIX"

function cachedBrand(): string | null {
  try {
    return localStorage.getItem(BRAND_KEY)
  } catch {
    return null
  }
}

// Nom de la boutique (Parametres > Identite). Le dernier nom connu est garde en memoire
// du navigateur pour eviter d'afficher l'ancien nom pendant le chargement.
export function useShopName(): string {
  const { data } = usePublicShop()
  const name = data?.shop_name?.trim() ?? ""
  useEffect(() => {
    if (!name) return
    try {
      localStorage.setItem(BRAND_KEY, name)
    } catch {
      /* stockage indisponible */
    }
  }, [name])
  return name || cachedBrand() || DEFAULT_BRAND
}