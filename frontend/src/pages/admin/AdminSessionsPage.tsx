import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import { sessionsApi } from "../../api/sessions"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"

interface CourseRow {
  id: number
  title: string
}

function minLocal(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export default function AdminSessionsPage() {
  const qc = useQueryClient()
  const [courseId, setCourseId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [when, setWhen] = useState("")
  const [note, setNote] = useState("")
  const [notify, setNotify] = useState(true)

  const courses = useQuery({
    queryKey: ["admin-live-courses"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as CourseRow[]
    },
  })

  const sessions = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => (await sessionsApi.adminList()).data.data,
    staleTime: 0,
  })

  const rows = courses.data ?? []
  const current = courseId ?? rows[0]?.id ?? null

  const create = useMutation({
    mutationFn: () =>
      sessionsApi.create({
        course_id: current as number,
        title: title.trim() || undefined,
        starts_at: new Date(when).toISOString(),
        note: note.trim() || undefined,
        notify,
      }),
    onSuccess: (res) => {
      toast.info(notify ? `Séance planifiée. ${res.data.data.notified} personne(s) prévenue(s).` : "Séance planifiée.")
      setTitle("")
      setWhen("")
      setNote("")
      void qc.invalidateQueries({ queryKey: ["admin-sessions"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => sessionsApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-sessions"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (current === null || !when) return
    create.mutate()
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">Séances planifiées</h1>

      {courses.isLoading && <ListSkeleton rows={2} />}
      {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data && rows.length === 0 && <p className="text-sm text-muted">Aucun cours. Créez d'abord un cours.</p>}

      {rows.length > 0 && current !== null && (
        <form onSubmit={submit} className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="font-semibold">Nouvelle séance</h2>

          <div>
            <label htmlFor="ses-course" className="block text-sm font-semibold">Cours</label>
            <select
              id="ses-course"
              value={current}
              onChange={(e) => setCourseId(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
            >
              {rows.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ses-when" className="block text-sm font-semibold">Date et heure</label>
              <input
                id="ses-when"
                type="datetime-local"
                required
                min={minLocal()}
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ses-title" className="block text-sm font-semibold">Titre (optionnel)</label>
              <input
                id="ses-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Ex : Séance 3 - Questions/réponses"
                className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ses-note" className="block text-sm font-semibold">Message (optionnel)</label>
            <textarea
              id="ses-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Prévenir maintenant les inscrits et les personnes déjà invitées (un rappel part aussi 15 min avant)
          </label>

          <Button type="submit" loading={create.isPending} disabled={!when}>Planifier</Button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">À venir</h2>
        {sessions.isLoading && <ListSkeleton rows={2} />}
        {sessions.error && <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />}
        {sessions.data && sessions.data.length === 0 && (
          <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">Aucune séance planifiée.</p>
        )}
        <ul className="space-y-3">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="min-w-0">
                <p className="font-semibold">{s.title || s.course_title}</p>
                <p className="mt-1 text-sm text-muted">
                  {new Date(s.starts_at).toLocaleString("fr-FR")}{s.title ? ` - ${s.course_title}` : ""}
                </p>
                {s.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{s.note}</p>}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { if (window.confirm("Supprimer cette séance ?")) remove.mutate(s.id) }}
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}