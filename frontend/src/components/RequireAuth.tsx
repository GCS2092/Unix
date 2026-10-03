import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { ErrorState, LoadingState } from "./States"

export default function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  return <>{children}</>
}