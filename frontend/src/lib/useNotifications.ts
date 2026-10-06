import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { notificationsApi } from "../api/notifications"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"

// Partage entre tous les composants : une notification n'est annoncee qu'une seule fois
const announced = new Set<string>()
let primedFor: string | null = null

export function useNotifications() {
  const user = useAuthStore((s) => s.user)
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await notificationsApi.list()).data,
    enabled: !!user,
    refetchInterval: 20000,
    staleTime: 5000,
    retry: false,
  })

  const items = query.data?.data

  useEffect(() => {
    if (!user || !items) return
    const who = String(user.id)
    // Premier chargement : on memorise l'existant sans l'annoncer
    if (primedFor !== who) {
      announced.clear()
      items.forEach((n) => announced.add(n.id))
      primedFor = who
      return
    }
    items.forEach((n) => {
      if (announced.has(n.id)) return
      announced.add(n.id)
      if (n.read_at) return
      const t = n.data.type
      if (t === "live_started") toast.info(`Le direct a commencé : ${n.data.course_title}`)
      else if (t === "live_reminder") toast.info(`Rappel : « ${n.data.session_title || n.data.course_title} » commence bientôt`)
      else if (t === "live_scheduled") toast.info(`Nouvelle séance planifiée : ${n.data.session_title || n.data.course_title}`)
      else toast.info(`Nouvelle invitation : ${n.data.course_title}`)
    })
  }, [items, user])

  return { items: items ?? [], unread: query.data?.unread_count ?? 0, query }
}