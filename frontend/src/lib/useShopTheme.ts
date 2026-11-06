import { useEffect } from "react"

/** Active la palette de la boutique (classe theme-boutique sur <html>) tant que le composant est affich\u00e9. */
export default function useShopTheme(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const el = document.documentElement
    el.classList.add("theme-boutique")
    return () => el.classList.remove("theme-boutique")
  }, [enabled])
}