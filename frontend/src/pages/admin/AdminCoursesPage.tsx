import { useState, type FormEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminCourse, type CoursePayload } from "../../api/admin"
import { instructorsApi } from "../../api/instructors"
import { useAuthStore } from "../../stores/authStore"
import { adminScopeOf } from "../../lib/adminPaths"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import { Badge, PageHeader, field, panel } from "../../components/admin/PageHeader"

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
    <form onSubmit={submit} data-tour="cs-form" className={`${panel} mb-6 space-y-4`}>
      <h2 className="text-lg font-semibold">
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-courses", page],
    queryFn: async () => (await adminApi.courses(page)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-courses"] })

  const toggle = useMutation({
    mutationFn: (c: AdminCourse) => adminApi.updateCourse(c.slug, { is_published: !c.is_published }),
    onSuccess: refresh,
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

  function handleDelete(c: AdminCourse) {
    if (window.confirm(t("admin.confirm_delete", { name: c.title }))) remove.mutate(c)
  }

  const actions = (c: AdminCourse) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <button type="button" onClick={() => setEditing(c)} className="min-h-[36px] font-semibold text-primary hover:underline">{t("admin.edit")}</button>
      <button type="button" onClick={() => toggle.mutate(c)} disabled={toggle.isPending} className="min-h-[36px] font-semibold text-muted hover:text-ink">
        {c.is_published ? t("admin.unpublish") : t("admin.publish")}
      </button>
      <button type="button" onClick={() => handleDelete(c)} disabled={remove.isPending} className="min-h-[36px] font-semibold text-danger hover:underline">{t("admin.delete")}</button>
    </div>
  )

  const owner = (c: AdminCourse) =>
    c.instructor_name ?? <span className="text-muted">{t("px.crs.unassigned", { defaultValue: "Non attribué" })}</span>

  return (
    <div>
      <PageHeader
        title={t("admin.courses", { defaultValue: "Cours" })}
        count={data?.meta.total}
        subtitle={canAssign ? undefined : t("px.crs.mine_hint", { defaultValue: "Vous ne voyez que les cours qui vous sont attribués." })}
        action={<Button data-tour="cs-add" onClick={() => setEditing("new")}>{t("admin.add_course", { defaultValue: "Ajouter un cours" })}</Button>}
      />

      {editing !== null && (
        <CourseForm
          key={editing === "new" ? "new" : editing.id}
          course={editing === "new" ? null : editing}
          canAssign={canAssign}
          onDone={() => setEditing(null)}
        />
      )}

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_courses", { defaultValue: "Aucun cours." })} />}

      {data && data.data.length > 0 && (
        <>
          <ul className="space-y-3 md:hidden">
            {data.data.map((c) => (
              <li key={c.id} className={panel}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 font-semibold">{c.title}</h2>
                  <Badge tone={c.is_published ? "success" : "muted"}>{c.is_published ? t("admin.published") : t("admin.draft")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{formatPrice(c.price)}</p>
                {canAssign && <p className="mt-1 text-sm">{owner(c)}</p>}
                <div className="mt-3 border-t border-line pt-2">{actions(c)}</div>
              </li>
            ))}
          </ul>

          <div data-tour="cs-table" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("admin.course_title", { defaultValue: "Titre" })}</th>
                  {canAssign && <th className="px-4 py-3 font-medium">{t("px.crs.instructor", { defaultValue: "Formateur" })}</th>}
                  <th className="px-4 py-3 font-medium">{t("admin.col_price")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((c) => (
                  <tr key={c.id} className="transition hover:bg-page/60">
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    {canAssign && <td className="px-4 py-3">{owner(c)}</td>}
                    <td className="whitespace-nowrap px-4 py-3">{formatPrice(c.price)}</td>
                    <td className="px-4 py-3"><Badge tone={c.is_published ? "success" : "muted"}>{c.is_published ? t("admin.published") : t("admin.draft")}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end">{actions(c)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}
