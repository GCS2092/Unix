import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { useTourStore } from "../stores/tourStore"
import { resolveTour } from "../lib/tours"

// Bouton "?" : relance le guide de la page affichee (visible seulement si la page en a un)
export default function TourButton() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const active = useTourStore((s) => s.active)
  const restart = useTourStore((s) => s.restart)

  if (!resolveTour(pathname, user)) return null

  return (
    <button
      type="button"
      data-tour="help"
      onClick={restart}
      disabled={active}
      aria-label={t("tour.help")}
      title={t("tour.help")}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-base font-bold text-primary transition duration-150 hover:bg-page active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      ?
    </button>
  )
}