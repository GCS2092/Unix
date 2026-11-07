import { Link } from "react-router-dom"
import BrandLogo from "./BrandLogo"
import useBrandSpace from "../hooks/useBrandSpace"

/** Logo cliquable : mene a la boutique, ou a la presentation des formations dans l'espace formation. */
export default function BrandHomeLink({ className = "" }: { className?: string }) {
  const formation = useBrandSpace() === "formation"
  return (
    <Link to={formation ? "/decouvrir/formations" : "/boutique"} className={className}>
      <BrandLogo />
    </Link>
  )
}