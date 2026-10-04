import { Navigate, useParams } from "react-router-dom"

// Anciennes adresses /mes-cours/:id -> nouvelle adresse de l'espace etudiant
export function LegacyCourseRedirect() {
  const { id } = useParams()
  return <Navigate to={`/etudiant/cours/${id ?? ""}`} replace />
}