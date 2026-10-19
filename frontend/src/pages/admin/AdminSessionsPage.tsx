import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { sessionsApi, type LiveSessionItem } from "../../api/sessions"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import { field, panel } from "../../components/admin/PageHeader"
import { IconButton, Pill, Svg } from "../../components/admin/ui"
import { EmptyBlock, Hero, ICON } from "../../components/admin/formationUi"

interface CourseRow { id: number; title: string }

function minLocal(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
  const [editingId, setEditingId] = useState<number | null>(null)

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

  const resetForm = () => { setEditingId(null); setTitle(""); setWhen(""); setNote("") }

  const update = useMutation({
    mutationFn: () =>
      sessionsApi.update(editingId as number, {
        title: title.trim() || null,
        starts_at: new Date(when).toISOString(),
        note: note.trim() || null,
        notify,
      }),
    onSuccess: (res) => {
      toast.info(
        res.data.data.rescheduled && notify
          ? t("px.ses.updated_notified", { n: res.data.data.notified, defaultValue: "Séance modifiée. {{n}} personne(s) prévenue(s)." })
          : t("px.ses.updated", { defaultValue: "Séance modifiée." }),
      )
      resetForm()
      void qc.invalidateQueries({ queryKey: ["admin-sessions"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => sessionsApi.remove(id),
    onSuccess: (_d, id) => {
      if (editingId === id) resetForm()
      void qc.invalidateQueries({ queryKey: ["admin-sessions"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function startEdit(s: LiveSessionItem) {
    setEditingId(s.id)
    setCourseId(s.course_id)
    setTitle(s.title ?? "")
    setWhen(toLocalInput(s.starts_at))
    setNote(s.note ?? "")
    setNotify(true)
    document.querySelector('[data-tour="se-form"]')?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (current === null || !when) return
    if (editingId !== null) update.mutate()
    else create.mutate()
  }

  const dayKey = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
  const today = dayKey(new Date().toISOString())
  const groups = new Map<string, NonNullable<typeof sessions.data>>()
  for (const s of sessions.data ?? []) {
    const k = dayKey(s.starts_at)
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  const firstId = sessions.data?.[0]?.id

  return (
    <div className="space-y-6">
      <Hero
        title={t("px.ses.title", { defaultValue: "Séances planifiées" })}
        count={sessions.data?.length}
        subtitle={t("px.ses.subtitle", { defaultValue: "Planifiez vos directs : les inscrits sont prévenus et reçoivent un rappel 15 min avant." })}
      />

      {courses.isLoading && <ListSkeleton rows={2} />}
      {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data && rows.length === 0 && (
        <EmptyBlock icon={ICON.book} text={t("px.ses.no_course", { defaultValue: "Aucun cours. Créez d'abord un cours." })} />
      )}

      {rows.length > 0 && current !== null && (
        <form onSubmit={submit} data-tour="se-form" className={`${panel} space-y-4 border-t-4 border-t-primary`}>
          <h2 className="flex items-center gap-2 font-bold">
            <Svg d={editingId !== null ? ICON.edit : ICON.calendar} className="h-5 w-5 text-primary" />
            {editingId !== null ? t("px.ses.edit", { defaultValue: "Modifier la séance" }) : t("px.ses.new", { defaultValue: "Nouvelle séance" })}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ses-course" className="block text-sm font-medium">{t("px.ses.course", { defaultValue: "Cours" })}</label>
              <select id="ses-course" disabled={editingId !== null} value={current} onChange={(e) => setCourseId(Number(e.target.value))} className={field}>
                {rows.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ses-when" className="block text-sm font-medium">{t("px.ses.when", { defaultValue: "Date et heure" })}</label>
              <input id="ses-when" data-tour="se-when" type="datetime-local" required min={editingId === null ? minLocal() : undefined} value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
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
          <label data-tour="se-notify" className="flex cursor-pointer items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            {editingId !== null ? t("px.ses.notify_edit", { defaultValue: "Prévenir les inscrits du changement d'horaire (uniquement si la date ou l'heure change)" }) : t("px.ses.notify", { defaultValue: "Prévenir maintenant les inscrits et les personnes déjà invitées (un rappel part aussi 15 min avant)" })}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={create.isPending || update.isPending} disabled={!when}>
              {editingId !== null ? t("px.ses.save", { defaultValue: "Enregistrer" }) : t("px.ses.plan", { defaultValue: "Planifier" })}
            </Button>
            {editingId !== null && (
              <Button type="button" variant="secondary" onClick={resetForm}>{t("px.ses.cancel", { defaultValue: "Annuler" })}</Button>
            )}
          </div>
        </form>
      )}

      <section data-tour="se-list" className="space-y-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Svg d={ICON.clock} className="h-5 w-5 text-primary" />
          {t("px.ses.upcoming", { defaultValue: "À venir" })}
        </h2>
        {sessions.isLoading && <ListSkeleton rows={2} />}
        {sessions.error && <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />}
        {sessions.data && sessions.data.length === 0 && (
          <EmptyBlock icon={ICON.calendar} text={t("px.ses.none", { defaultValue: "Aucune séance planifiée." })} />
        )}
        {[...groups.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              {day}
              {day === today && <Pill tone="warn" dot>{t("px.ses.today", { defaultValue: "Aujourd'hui" })}</Pill>}
            </p>
            <ul className="stagger space-y-2.5">
              {list.map((s) => (
                <li key={s.id} className={`${panel} flex items-start justify-between gap-3 border-l-4 border-l-primary/70 !py-3.5 transition hover:shadow-card-lg`}>
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 h-fit shrink-0 rounded-xl bg-primary px-3 py-1.5 text-sm font-bold tabular-nums text-white shadow-sm">
                      {new Date(s.starts_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {s.title || s.course_title}
                        {s.id === firstId && <Pill tone="info" dot>{t("px.ses.next_badge", { defaultValue: "Prochaine" })}</Pill>}
                      </p>
                      {s.title && <p className="text-sm text-muted">{s.course_title}</p>}
                      {s.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{s.note}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <IconButton label={t("admin.edit", { defaultValue: "Modifier" })} onClick={() => startEdit(s)}>
                      <Svg d={ICON.edit} className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={t("admin.delete", { defaultValue: "Supprimer" })} danger
                      onClick={() => {
                        if (window.confirm(t("px.ses.confirm_delete", { defaultValue: "Supprimer cette séance ?" }))) remove.mutate(s.id)
                      }}
                    >
                      <Svg d={ICON.trash} className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}