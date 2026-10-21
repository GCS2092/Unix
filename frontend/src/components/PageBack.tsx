import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

interface Props {
  fallback?: string
  variant?: "default" | "dark"
  className?: string
}

/** Bouton Retour : page precedente si elle existe dans l'historique, sinon une page de secours. */
export default function PageBack({ fallback = "/boutique", variant = "default", className = "" }: Props) {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const fr = (i18n.language || "fr").startsWith("fr")

  const go = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }

  const tone =
    variant === "dark"
      ? "border-white/50 bg-black/25 text-white hover:bg-black/40"
      : "border-line bg-surface text-ink hover:bg-black/5"

  return (
    <button
      type="button"
      onClick={go}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95 ${tone} ${className}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {fr ? "Retour" : "Back"}
    </button>
  )
}