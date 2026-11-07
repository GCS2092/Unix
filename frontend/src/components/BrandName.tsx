import { useEffect } from "react"
import { useShopName } from "../hooks/usePublicShop"
import useBrandSpace from "../hooks/useBrandSpace"
import { FORMATION_NAME } from "../lib/logoConfig"

let lastName = "BETCC"

// Affiche le nom de la marque (boutique ou formation) et garde le titre de l'onglet a jour
export default function BrandName() {
  const shop = useShopName()
  const name = useBrandSpace() === "formation" ? FORMATION_NAME : shop
  useEffect(() => {
    if (name === lastName) return
    document.title = document.title.split(lastName).join(name)
    lastName = name
  }, [name])
  return <>{name}</>
}