import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { adminHome, canAccessSpace, type AdminSpace } from "../lib/adminPaths"
import { ErrorState, LoadingState } from "./States"

export default function RequireAdmin({ children, space }: { children: ReactNode; space?: AdminSpace }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />

  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />

  if (!user.is_admin) return <Navigate to={user.is_student ? "/etudiant" : "/"} replace />
  if (!user.is_admin) {
    return (
      <p role="alert" className="py-16 text-center text-danger">
        {t("errors.admin_only", { defaultValue: "Accès réservé aux administrateurs." })}
      </p>
    )
  }
  if (!canAccessSpace(user, space)) {
    const home = adminHome(user)
    // Redirection automatique vers son propre espace (le message ci-dessous reste un garde-fou anti-boucle)
    if (!location.pathname.startsWith(home)) return <Navigate to={home} replace />
  }
  if (!canAccessSpace(user, space)) {
    return (
      <div role="alert" className="py-16 text-center">
        <p className="text-danger">{t("errors.admin_scope", { defaultValue: "Votre compte n'a pas accès à cet espace d'administration." })}</p>
        <Link to={adminHome(user)} className="mt-3 inline-block font-semibold text-primary hover:underline">
          {t("errors.admin_scope_back", { defaultValue: "Aller à mon espace" })}
        </Link>
      </div>
    )
  }
  return <>{children}</>
}