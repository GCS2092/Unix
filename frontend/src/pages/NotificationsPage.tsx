import { Link } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationsApi, type AppNotification } from "../api/notifications"
import { useNotifications } from "../lib/useNotifications"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "../components/Button"

function describe(n: AppNotification): { title: string; text: string; cta: string } {
  const d = n.data
  const when = d.starts_at ? new Date(d.starts_at).toLocaleString("fr-FR") : ""
  const label = d.session_title || d.course_title
  switch (d.type) {
    case "live_started":
      return { title: `Le direct a commencé : ${d.course_title}`, text: "La session vient de démarrer. Rejoignez-la maintenant.", cta: "Rejoindre maintenant" }
    case "live_reminder":
      return { title: `Rappel : ${label}`, text: `La session commence bientôt (${when}).`, cta: "Rejoindre" }
    case "live_scheduled":
      return { title: `Séance planifiée : ${label}`, text: `Prévue le ${when}.`, cta: "Voir" }
    default:
      return {
        title: `Session en direct : ${d.course_title}`,
        text: `${d.invited_by ? `${d.invited_by} vous invite` : "Vous êtes invité(e)"} à rejoindre cette session.`,
        cta: "Rejoindre",
      }
  }
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const { items, unread, query } = useNotifications()
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] })

  const readOne = useMutation({
    mutationFn: (id: string) => notificationsApi.read(id),
    onSuccess: refresh,
  })
  const readAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Notifications</h1>
        {unread > 0 && (
          <Button size="sm" variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate()}>
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {query.isLoading && <p role="status" className="text-sm text-muted">Chargement…</p>}
      {query.error && <p role="alert" className="text-sm text-danger">{getErrorMessage(query.error)}</p>}
      {query.data && items.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
          Aucune notification pour le moment.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((n) => {
          const unreadItem = !n.read_at
          const d = describe(n)
          return (
            <li
              key={n.id}
              className={`rounded-card border bg-surface p-4 shadow-card ${unreadItem ? "border-primary" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {unreadItem && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
                    {d.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{d.text}</p>
                  {n.data.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{n.data.note}</p>}
                  <p className="mt-2 text-xs text-muted">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <Link
                  to={n.data.path}
                  onClick={() => unreadItem && readOne.mutate(n.id)}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  {d.cta}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}