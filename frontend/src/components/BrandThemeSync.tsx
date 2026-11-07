import { useEffect, useLayoutEffect } from "react"
import useBrandSpace from "../hooks/useBrandSpace"
import { LOGO_SRC, FORMATION_LOGO_SRC } from "../lib/logoConfig"

const SHOP_ICON = "/favicon.svg"
const SHOP_COLOR = "#2b3150"
const FORMATION_ICON = "/favicon-iga.svg"
const FORMATION_COLOR = "#1f64c0"
const FORMATION_MANIFEST = "/manifest-iga.webmanifest"
const FORMATION_TOUCH_ICON = "/apple-touch-icon-iga.png"

/** Met le <link> de l'espace formation, et restitue celui de la boutique en quittant. */
function swapLink(rel: string, formationHref: string, formation: boolean) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (formation) {
    if (!el) {
      el = document.createElement("link")
      el.rel = rel
      el.dataset.created = "1"
      document.head.appendChild(el)
    } else if (el.dataset.shopHref === undefined) {
      el.dataset.shopHref = el.getAttribute("href") ?? ""
    }
    el.setAttribute("href", formationHref)
  } else if (el) {
    if (el.dataset.created === "1") el.remove()
    else if (el.dataset.shopHref) el.setAttribute("href", el.dataset.shopHref)
  }
}

/** Pose la palette, les icones et l'identite de l'application selon l'espace (boutique BETCC, formation IGA, systeme neutre). */
export default function BrandThemeSync() {
  const space = useBrandSpace()

  // Les logos sont charges des l'ouverture : le basculement d'un espace a l'autre est instantane.
  useEffect(() => {
    for (const s of [LOGO_SRC, FORMATION_LOGO_SRC, FORMATION_ICON]) {
      if (!s) continue
      const img = new Image()
      img.decoding = "async"
      img.src = s
    }
  }, [])

  useLayoutEffect(() => {
    const el = document.documentElement
    el.classList.remove("theme-boutique", "theme-formation")
    if (space === "shop") el.classList.add("theme-boutique")
    else if (space === "formation") el.classList.add("theme-formation")

    const formation = space === "formation"
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) icon.setAttribute("href", formation ? FORMATION_ICON : SHOP_ICON)
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = formation ? FORMATION_COLOR : SHOP_COLOR

    // Application installable : manifeste, icone iPhone et nom propres a chaque espace
    swapLink("manifest", FORMATION_MANIFEST, formation)
    swapLink("apple-touch-icon", FORMATION_TOUCH_ICON, formation)
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (title) {
      if (title.dataset.shopContent === undefined) title.dataset.shopContent = title.content
      title.content = formation ? "IGA" : title.dataset.shopContent
    }
  }, [space])
  return null
}