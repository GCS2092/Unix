import { useQuery } from "@tanstack/react-query"
import { siteInfoApi } from "../api/siteInfo"
import { usePublicShop } from "./usePublicShop"
import { WHATSAPP_NUMBER, setWhatsappNumber } from "../lib/whatsapp"

// Complements du site (message WhatsApp, TVA, retrait propose, moyens de paiement...)
export function useSiteInfo() {
  return useQuery({
    queryKey: ["public-site-info"],
    queryFn: async () => (await siteInfoApi.publicInfo()).data.data,
    staleTime: 60_000,
  })
}

// Numero WhatsApp unique : Parametres > Contact, sinon valeur du .env
export function useWhatsappNumber(): string {
  const { data } = usePublicShop()
  const n = (data?.support_whatsapp ?? "").replace(/\D/g, "") || WHATSAPP_NUMBER
  setWhatsappNumber(n)
  return n
}