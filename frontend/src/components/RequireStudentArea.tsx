import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { canAccessSpace } from "../lib/adminPaths"
import { ErrorState, LoadingState } from "./States"
import { PortalFrame } from "./PortalLogin"
import Button from "./Button"

// Garde de l'espace etudiant : renvoie vers la page de connexion unique.
export default function RequireStudentArea({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />

  if (!user.is_student && !canAccessSpace(user, "formation")) {
    return (
      <PortalFrame brand={t("px.portal.student_brand")}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{t("px.portal.student_denied")}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {WHATSAPP_NUMBER && (
            <a
              href={whatsappUrl(t("px.portal.wa_message_email") + user.email)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-semibold text-primary hover:underline"
            >
              {t("px.portal.ask_access_short")}
            </a>
          )}
          <Button variant="secondary" full onClick={() => void logout()}>{t("px.portal.logout")}</Button>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link>
        </p>
      </PortalFrame>
    )
  }

  return <>{children}</>
}
