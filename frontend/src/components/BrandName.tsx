import { useEffect } from "react"
import { useShopName } from "../hooks/usePublicShop"

let lastName = "UNIX"

// Affiche le nom de la boutique et garde le titre de l'onglet a jour
export default function BrandName() {
  const name = useShopName()
  useEffect(() => {
    if (name === lastName) return
    document.title = document.title.split(lastName).join(name)
    lastName = name
  }, [name])
  return <>{name}</>
}