import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { ErrorState, LoadingState } from "./States"
import { PortalFrame } from "./PortalLogin"
import Button from "./Button"

const T = {
  brand: "Espace \u00e9tudiant",
  denied: "Ce compte n'a pas encore acc\u00e8s aux formations.",
  askAccess: "Demander l'acc\u00e8s",
  logout: "Se d\u00e9connecter",
  shop: "Retour \u00e0 la boutique",
  waMessage: "Bonjour, je souhaite acc\u00e9der aux formations. Mon e-mail : ",
}

// Garde de l'espace etudiant : renvoie vers SA page de connexion, jamais vers celle de la boutique.
export default function RequireStudentArea({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />
  if (!user) return <Navigate to="/etudiant/connexion" state={{ from: location.pathname }} replace />

  if (!user.is_student && !user.is_admin) {
    return (
      <PortalFrame brand={T.brand}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{T.denied}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {WHATSAPP_NUMBER && (
            <a
              href={whatsappUrl(T.waMessage + user.email)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-semibold text-primary hover:underline"
            >
              {T.askAccess}
            </a>
          )}
          <Button variant="secondary" full onClick={() => void logout()}>{T.logout}</Button>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link>
        </p>
      </PortalFrame>
    )
  }

  return <>{children}</>
}