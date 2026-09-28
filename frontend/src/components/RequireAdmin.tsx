import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { LoadingState } from "./States"

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  if (!user.is_admin) {
    return <p className="py-16 text-center text-danger">Accès réservé aux administrateurs.</p>
  }
  return <>{children}</>
}