import { useLayoutEffect } from "react"
import useBrandSpace from "../hooks/useBrandSpace"

/** Pose la palette de la marque sur <html> selon l'espace affiche (boutique BETCC, formation IGA, systeme neutre). */
export default function BrandThemeSync() {
  const space = useBrandSpace()
  useLayoutEffect(() => {
    const el = document.documentElement
    el.classList.remove("theme-boutique", "theme-formation")
    if (space === "shop") el.classList.add("theme-boutique")
    else if (space === "formation") el.classList.add("theme-formation")
  }, [space])
  return null
}