import { Link } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationsApi } from "../api/notifications"
import { useNotifications } from "../lib/useNotifications"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "../components/Button"

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
          const started = n.data.type === "live_started"
          return (
            <li
              key={n.id}
              className={`rounded-card border bg-surface p-4 shadow-card ${unreadItem ? "border-primary" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {unreadItem && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
                    {started ? "Le direct a commencé : " : "Session en direct : "}{n.data.course_title}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {started
                      ? "La session vient de démarrer. Rejoignez-la maintenant."
                      : `${n.data.invited_by ? `${n.data.invited_by} vous invite` : "Vous êtes invité(e)"} à rejoindre cette session.`}
                  </p>
                  {n.data.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{n.data.note}</p>}
                  <p className="mt-2 text-xs text-muted">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <Link
                  to={n.data.path}
                  onClick={() => unreadItem && readOne.mutate(n.id)}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  {started ? "Rejoindre maintenant" : "Rejoindre"}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}