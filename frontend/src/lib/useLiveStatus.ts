import { useQuery } from "@tanstack/react-query"
import { liveStatusApi } from "../api/live"
import { useAuthStore } from "../stores/authStore"

export function useLiveStatus() {
  const user = useAuthStore((s) => s.user)
  const q = useQuery({
    queryKey: ["live-status"],
    queryFn: async () => (await liveStatusApi.status()).data.data,
    enabled: !!user,
    refetchInterval: 15000,
    staleTime: 5000,
    retry: false,
  })
  const items = q.data ?? []
  // undefined = statut inconnu (chargement ou erreur) : le serveur tranchera a la connexion
  const isLive = (courseId?: number): boolean | undefined =>
    q.data === undefined || courseId === undefined ? undefined : q.data.some((i) => i.course_id === courseId)
  return { items, isLive }
}