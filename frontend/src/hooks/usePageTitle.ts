import { useEffect } from "react"
import { useShopName } from "./usePublicShop"

/** Titre de l'onglet : "<page> - <nom de la boutique>", restaure le titre precedent en quittant la page. */
export function usePageTitle(title: string): void {
  const name = useShopName()
  useEffect(() => {
    const previous = document.title
    document.title = name ? `${title} \u2014 ${name}` : title
    return () => {
      document.title = previous
    }
  }, [title, name])
}