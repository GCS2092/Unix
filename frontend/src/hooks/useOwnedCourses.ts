import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { enrollmentsApi } from "../api/enrollments"
import { useAuthStore } from "../stores/authStore"

export const enrollmentsKey = (userId: number | undefined) => ["enrollments", userId] as const

// Inscriptions de l'utilisateur connecte (la cle contient l'id : pas de melange entre comptes)
export function useEnrollments() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: enrollmentsKey(userId),
    queryFn: async () => (await enrollmentsApi.list()).data.data,
    enabled: userId !== undefined,
  })
}

// Map id du cours -> id de l'inscription, pour afficher "Acceder" au lieu de "Ajouter au panier"
export function useOwnedCourses(): Map<number, number> {
  const { data } = useEnrollments()
  return useMemo(() => {
    const owned = new Map<number, number>()
    for (const e of data ?? []) if (e.course) owned.set(e.course.id, e.id)
    return owned
  }, [data])
}