import { useEffect, useState, type FormEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminCourse, type CoursePayload } from "../../api/admin"
import { instructorsApi } from "../../api/instructors"
import { apiClient } from "../../api/client"
import { useAuthStore } from "../../stores/authStore"
import { adminScopeOf } from "../../lib/adminPaths"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import { field, panel } from "../../components/admin/PageHeader"
import { IconButton, Pill, Svg } from "../../components/admin/ui"
import { Avatar, Hero, ICON, ProgressBar, SearchBox, Segmented, heroBtn } from "../../components/admin/formationUi"

type CourseRow = AdminCourse & { enrollments_count?: number; completed_count?: number; avg_progress?: number | null }
type CoursesPage = { data: CourseRow[]; meta: { current_page: number; last_page: number; total: number } }

function CourseForm({ course, canAssign, onDone }: { course: AdminCourse | null; canAssign: boolean; onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(course?.title ?? "")
  const [description, setDescription] = useState(course?.description ?? "")
  const [price, setPrice] = useState(String(course?.price ?? 0))
  const [video, setVideo] = useState(course?.stream_video_id ?? "")
  const [room, setRoom] = useState(course?.livekit_room ?? "")
  const [duration, setDuration] = useState(course?.duration_seconds ? String(Math.round(course.duration_seconds / 60)) : "")
  const [published, setPublished] = useState(course?.is_published ?? false)
  const [instructor, setInstructor] = useState(course?.instructor_id ? String(course.instructor_id) : "")
  const [error, setError] = useState<string | null>(null)

  const instructors = useQuery({
    queryKey: ["admin-instructors"],
    queryFn: async () => (await instructorsApi.list()).data.data,
    enabled: canAssign,
  })

  const save = useMutation({
    mutationFn: (p: CoursePayload) => (course ? adminApi.updateCourse(course.slug, p) : adminApi.createCourse(p)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      await queryClient.invalidateQueries({ queryKey: ["admin-live-courses"] })
      toast.success(t("admin.saved", { defaultValue: "Enregistré" }))
      onDone()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const n = Number(price)
    if (!Number.isInteger(n) || n < 0) {
      setError(t("admin.price_error"))
      return
    }
    save.mutate({
      title: title.trim(),
      description: description.trim() === "" ? null : description,
      price: n,
      stream_video_id: video.trim() === "" ? null : video.trim(),
      livekit_room: room.trim() === "" ? null : room.trim(),
      duration_seconds: duration.trim() === "" ? null : Math.round(Number(duration) * 60),
      is_published: published,
      ...(canAssign ? { instructor_id: instructor ? Number(instructor) : null } : {}),
    })
  }

  return (
    <form onSubmit={submit} data-tour="cs-form" className={`${panel} mb-6 space-y-4 border-t-4 border-t-primary`}>
      <h2 className="text-lg font-bold">
        {course ? t("admin.edit_title", { name: course.title }) : t("admin.new_course", { defaultValue: "Nouveau cours" })}
      </h2>
      <label className="block text-sm font-medium">
        {t("admin.course_title", { defaultValue: "Titre" })}
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </label>
      <label className="block text-sm font-medium">
        {t("admin.description")}
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("admin.price_label")}
          <input type="number" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">
          {t("px.crs.duration", { defaultValue: "Durée de la vidéo (minutes)" })}
          <input type="number" min={1} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.video_id", { defaultValue: "ID vidéo (Bunny Stream)" })}
          <input type="text" value={video} onChange={(e) => setVideo(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.live_room", { defaultValue: "Salle live (LiveKit)" })}
          <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} className={field} />
        </label>
      </div>
      {canAssign && (
        <label className="block text-sm font-medium">
          {t("px.crs.instructor", { defaultValue: "Formateur" })}
          <select value={instructor} onChange={(e) => setInstructor(e.target.value)} className={field}>
            <option value="">{t("px.crs.no_instructor", { defaultValue: "Aucun (visible par l'administration seulement)" })}</option>
            {instructors.data?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.email})</option>)}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="h-5 w-5" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("admin.published_label")}
      </label>
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={save.isPending}>{t("admin.save")}</Button>
        <Button variant="secondary" onClick={onDone}>{t("admin.cancel")}</Button>
      </div>
    </form>
  )
}

export default function AdminCoursesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canAssign = adminScopeOf(user) !== "instructor"
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<AdminCourse | "new" | null>(null)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-courses", page, q, status],
    queryFn: async () =>
      (await apiClient.get<CoursesPage>("/admin/courses", { params: { page, q: q || undefined, status: status || undefined } })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-courses"] })

  const toggle = useMutation({
    mutationFn: (c: AdminCourse) => adminApi.updateCourse(c.slug, { is_published: !c.is_published }),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const duplicate = useMutation({
    mutationFn: (c: AdminCourse) => apiClient.post(`/admin/courses/${c.slug}/duplicate`),
    onSuccess: async () => {
      toast.success(t("admin.duplicated", { defaultValue: "Cours dupliqué (en brouillon)" }))
      setPage(1)
      if (status === "published") setStatus("")
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ["admin-live-courses"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (c: AdminCourse) => adminApi.deleteCourse(c.slug),
    onSuccess: async () => {
      if (data && data.data.length === 1 && page > 1) setPage(page - 1)
      toast.success(t("admin.deleted", { defaultValue: "Supprimé" }))
      await refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function handleDelete(c: CourseRow) {
    const n = c.enrollments_count ?? 0
    const warn = n > 0 ? `\n\nCe cours compte ${n} inscription${n > 1 ? "s" : ""}.` : ""
    if (window.confirm(t("admin.confirm_delete", { name: c.title }) + warn)) remove.mutate(c)
  }

  const enrolled = (c: CourseRow) => c.enrollments_count ?? 0
  const avgPct = (c: CourseRow) => Math.round(c.avg_progress ?? 0)

  return (
    <div>
      <Hero
        title={t("admin.courses", { defaultValue: "Cours" })}
        count={data?.meta.total}
        subtitle={canAssign ? t("px.crs.hero", { defaultValue: "Créez, publiez et suivez vos formations." }) : t("px.crs.mine_hint", { defaultValue: "Vous ne voyez que les cours qui vous sont attribués." })}
        actions={
          <button type="button" data-tour="cs-add" onClick={() => setEditing("new")} className={heroBtn}>
            <Svg d={ICON.plus} className="h-4 w-4" />{t("admin.add_course", { defaultValue: "Ajouter un cours" })}
          </button>
        }
      />

      {editing !== null && (
        <CourseForm
          key={editing === "new" ? "new" : editing.id}
          course={editing === "new" ? null : editing}
          canAssign={canAssign}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={input} onChange={setInput} placeholder={t("px.crs.search", { defaultValue: "Rechercher un cours" })} />
        <Segmented
          value={status} onChange={(v) => { setStatus(v); setPage(1) }}
          items={[
            { id: "", label: t("px.crs.f_all", { defaultValue: "Tous" }) },
            { id: "published", label: t("px.crs.f_published", { defaultValue: "Publiés" }) },
            { id: "draft", label: t("px.crs.f_draft", { defaultValue: "Brouillons" }) },
          ]}
        />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_courses", { defaultValue: "Aucun cours." })} />}

      {data && data.data.length > 0 && (
        <ul data-tour="cs-table" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.data.map((c) => (
            <li key={c.id} className="group flex flex-col rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-lg sm:p-5">
              <div className="flex items-start gap-3">
                <Avatar name={c.title} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-bold leading-snug">{c.title}</h2>
                  <p className="mt-0.5 text-sm font-semibold text-primary">{formatPrice(c.price)}</p>
                </div>
                <Pill tone={c.is_published ? "success" : "neutral"} dot>{c.is_published ? t("admin.published") : t("admin.draft")}</Pill>
              </div>

              {canAssign && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                  <Svg d={ICON.users} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.instructor_name ?? t("px.crs.unassigned", { defaultValue: "Non attribué" })}</span>
                </p>
              )}

              <div className="mt-4 rounded-xl bg-page/70 p-3">
                <div className="mb-2 flex items-baseline justify-between text-xs text-muted">
                  <span><strong className="text-base font-extrabold text-ink">{enrolled(c)}</strong> {enrolled(c) > 1 ? "inscrits" : "inscrit"}</span>
                  <span>{avgPct(c)} % en moyenne</span>
                </div>
                <ProgressBar value={avgPct(c)} />
              </div>

              <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-line pt-3">
                <IconButton label={t("admin.edit")} onClick={() => setEditing(c)}>
                  <Svg d={ICON.edit} className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("admin.duplicate", { defaultValue: "Dupliquer" })} onClick={() => duplicate.mutate(c)} disabled={duplicate.isPending}>
                  <Svg d={ICON.copy} className="h-4 w-4" />
                </IconButton>
                <IconButton label={c.is_published ? t("admin.unpublish") : t("admin.publish")} onClick={() => toggle.mutate(c)} disabled={toggle.isPending}>
                  <Svg d={c.is_published ? ICON.eyeOff : ICON.eye} className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("admin.delete")} danger onClick={() => handleDelete(c)} disabled={remove.isPending}>
                  <Svg d={ICON.trash} className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}