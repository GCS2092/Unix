import { useState } from "react"
import BrandName from "./BrandName"
import useBrandSpace from "../hooks/useBrandSpace"
import { useShopName } from "../hooks/usePublicShop"
import { LOGO_SRC, LOGO_HAS_NAME, FORMATION_LOGO_SRC, FORMATION_LOGO_HAS_NAME, FORMATION_NAME } from "../lib/logoConfig"

const MAX_TRIES = 3

// Logo de la marque : BETCC pour la boutique, IGA pour la formation. A defaut d'image : pastille + nom
export default function BrandLogo({
  onDark = false,
  size = "md",
  label,
}: {
  onDark?: boolean
  size?: "sm" | "md" | "lg"
  label?: string
}) {
  const formation = useBrandSpace() === "formation"
  const shopName = useShopName()
  const brand = formation ? FORMATION_NAME : shopName
  const logoSrc = formation ? FORMATION_LOGO_SRC : LOGO_SRC
  const hasName = formation ? FORMATION_LOGO_HAS_NAME : LOGO_HAS_NAME
  // Echecs de chargement par fichier : on reessaie avant de se rabattre sur le texte
  const [fail, setFail] = useState<{ src: string; n: number } | null>(null)
  const tries = fail && fail.src === logoSrc ? fail.n : 0
  const text = label || <BrandName />

  if (logoSrc && tries < MAX_TRIES) {
    const hgt = hasName
      ? size === "lg" ? "clamp(56px, 9vw, 80px)" : size === "sm" ? "36px" : "clamp(40px, 6vw, 56px)"
      : size === "lg" ? "44px" : size === "sm" ? "28px" : "32px"
    const img = (
      <img
        key={`${logoSrc}-${tries}`}
        src={tries > 0 ? `${logoSrc}?r=${tries}` : logoSrc}
        alt={hasName ? brand : ""}
        loading="eager"
        decoding="async"
        onError={() => { window.setTimeout(() => setFail({ src: logoSrc, n: tries + 1 }), 800) }}
        style={{ height: hgt, width: "auto", maxWidth: 260, maxHeight: hgt }}
        className="block shrink-0 object-contain"
      />
    )
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        {onDark ? <span className="inline-flex rounded-xl bg-white p-2 shadow-sm">{img}</span> : img}
        {!hasName && <span className="truncate">{text}</span>}
      </span>
    )
  }

  const initial = (label || brand || "B").trim().charAt(0).toUpperCase()
  const box = size === "lg" ? "h-10 w-10 text-xl" : "h-8 w-8 text-base"
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`grid ${box} shrink-0 place-items-center rounded-lg font-extrabold shadow-sm ${onDark ? "bg-surface text-primary" : "bg-primary text-white"}`}
      >
        {initial}
      </span>
      <span className="truncate">{text}</span>
    </span>
  )
}