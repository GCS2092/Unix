import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { sessionsApi } from "../../api/sessions"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import { Badge, PageHeader, field, panel } from "../../components/admin/PageHeader"

interface CourseRow { id: number; title: string }

function minLocal(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export default function AdminSessionsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
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
      toast.info(
        notify
          ? t("px.ses.planned_notified", { n: res.data.data.notified, defaultValue: "Séance planifiée. {{n}} personne(s) prévenue(s)." })
          : t("px.ses.planned", { defaultValue: "Séance planifiée." }),
      )
      setTitle(""); setWhen(""); setNote("")
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

  const dayKey = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
  const today = dayKey(new Date().toISOString())
  const groups = new Map<string, NonNullable<typeof sessions.data>>()
  for (const s of sessions.data ?? []) {
    const k = dayKey(s.starts_at)
    groups.set(k, [...(groups.get(k) ?? []), s])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("px.ses.title", { defaultValue: "Séances planifiées" })}
        count={sessions.data?.length}
        subtitle={t("px.ses.subtitle", { defaultValue: "Planifiez vos directs : les inscrits sont prévenus et reçoivent un rappel 15 min avant." })}
      />

      {courses.isLoading && <ListSkeleton rows={2} />}
      {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data && rows.length === 0 && (
        <p className={`${panel} text-sm text-muted`}>{t("px.ses.no_course", { defaultValue: "Aucun cours. Créez d'abord un cours." })}</p>
      )}

      {rows.length > 0 && current !== null && (
        <form onSubmit={submit} data-tour="se-form" className={`${panel} space-y-4`}>
          <h2 className="font-semibold">{t("px.ses.new", { defaultValue: "Nouvelle séance" })}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ses-course" className="block text-sm font-medium">{t("px.ses.course", { defaultValue: "Cours" })}</label>
              <select id="ses-course" value={current} onChange={(e) => setCourseId(Number(e.target.value))} className={field}>
                {rows.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ses-when" className="block text-sm font-medium">{t("px.ses.when", { defaultValue: "Date et heure" })}</label>
              <input id="ses-when" data-tour="se-when" type="datetime-local" required min={minLocal()} value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label htmlFor="ses-title" className="block text-sm font-medium">{t("px.ses.title_opt", { defaultValue: "Titre (optionnel)" })}</label>
            <input id="ses-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              placeholder={t("px.ses.title_ph", { defaultValue: "Ex : Séance 3 - Questions/réponses" })} className={field} />
          </div>
          <div>
            <label htmlFor="ses-note" className="block text-sm font-medium">{t("px.ses.note_opt", { defaultValue: "Message (optionnel)" })}</label>
            <textarea id="ses-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={field} />
          </div>
          <label data-tour="se-notify" className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            {t("px.ses.notify", { defaultValue: "Prévenir maintenant les inscrits et les personnes déjà invitées (un rappel part aussi 15 min avant)" })}
          </label>
          <Button type="submit" loading={create.isPending} disabled={!when}>{t("px.ses.plan", { defaultValue: "Planifier" })}</Button>
        </form>
      )}

      <section data-tour="se-list" className="space-y-4">
        <h2 className="font-semibold">{t("px.ses.upcoming", { defaultValue: "À venir" })}</h2>
        {sessions.isLoading && <ListSkeleton rows={2} />}
        {sessions.error && <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />}
        {sessions.data && sessions.data.length === 0 && (
          <p className={`${panel} text-sm text-muted`}>{t("px.ses.none", { defaultValue: "Aucune séance planifiée." })}</p>
        )}
        {[...groups.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {day}
              {day === today && <Badge tone="warning">{t("px.ses.today", { defaultValue: "Aujourd'hui" })}</Badge>}
            </p>
            <ul className="space-y-2">
              {list.map((s) => (
                <li key={s.id} className={`${panel} flex items-start justify-between gap-3 !py-3`}>
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
                      {new Date(s.starts_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{s.title || s.course_title}</p>
                      {s.title && <p className="text-sm text-muted">{s.course_title}</p>}
                      {s.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{s.note}</p>}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => {
                    if (window.confirm(t("px.ses.confirm_delete", { defaultValue: "Supprimer cette séance ?" }))) remove.mutate(s.id)
                  }}>
                    {t("admin.delete", { defaultValue: "Supprimer" })}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
