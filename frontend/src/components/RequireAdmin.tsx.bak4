import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { ErrorState, LoadingState } from "./States"

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  if (!user.is_admin) {
    return (
      <p role="alert" className="py-16 text-center text-danger">
        {t("errors.admin_only", { defaultValue: "Accès réservé aux administrateurs." })}
      </p>
    )
  }
  return <>{children}</>
}