import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { canAccessSpace } from "../lib/adminPaths"

// A placer a l'interieur de <RequireAuth> : un client non etudiant est renvoye a l'accueil.
export default function RequireStudent({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user?.is_student && !canAccessSpace(user, "formation")) return <Navigate to="/" replace />
  return <>{children}</>
}