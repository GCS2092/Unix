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