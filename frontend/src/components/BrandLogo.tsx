import { useState } from "react"
import BrandName from "./BrandName"
import { useShopName } from "../hooks/usePublicShop"
import { LOGO_SRC, LOGO_HAS_NAME } from "../lib/logoConfig"

// Logo de la marque : image choisie (public/logo.*) ou, a defaut, pastille + nom
export default function BrandLogo({
  onDark = false,
  size = "md",
  label,
}: {
  onDark?: boolean
  size?: "md" | "lg"
  label?: string
}) {
  const shopName = useShopName()
  const [broken, setBroken] = useState(false)
  const h = size === "lg" ? "h-11" : "h-8"
  const text = label || <BrandName />

  if (LOGO_SRC && !broken) {
    const img = (
      <img
        src={LOGO_SRC}
        alt={LOGO_HAS_NAME ? shopName : ""}
        onError={() => setBroken(true)}
        className={`${h} w-auto max-w-[180px] object-contain`}
      />
    )
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        {onDark ? <span className="inline-flex rounded-lg bg-white p-1.5">{img}</span> : img}
        {!LOGO_HAS_NAME && <span className="truncate">{text}</span>}
      </span>
    )
  }

  const initial = (label || shopName || "U").trim().charAt(0).toUpperCase()
  const box = size === "lg" ? "h-10 w-10 text-xl" : "h-8 w-8 text-base"
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`grid ${box} shrink-0 place-items-center rounded-lg font-extrabold shadow-sm ${onDark ? "bg-white text-primary" : "bg-primary text-white"}`}
      >
        {initial}
      </span>
      <span className="truncate">{text}</span>
    </span>
  )
}