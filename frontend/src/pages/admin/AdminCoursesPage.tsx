import { useState, type FormEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminCourse, type CoursePayload } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"

const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function CourseForm({ course, onDone }: { course: AdminCourse | null; onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(course?.title ?? "")
  const [description, setDescription] = useState(course?.description ?? "")
  const [price, setPrice] = useState(String(course?.price ?? 0))
  const [video, setVideo] = useState(course?.stream_video_id ?? "")
  const [room, setRoom] = useState(course?.livekit_room ?? "")
  const [published, setPublished] = useState(course?.is_published ?? false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (p: CoursePayload) => (course ? adminApi.updateCourse(course.slug, p) : adminApi.createCourse(p)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
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
      is_published: published,
    })
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold">
        {course ? t("admin.edit_title", { name: course.title }) : t("admin.new_course", { defaultValue: "Nouveau cours" })}
      </h2>
      <label className="block text-sm font-medium">
        {t("admin.course_title", { defaultValue: "Titre" })}
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("admin.description")}
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("admin.price_label")}
        <input type="number" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("admin.video_id", { defaultValue: "ID vidéo (Bunny Stream)" })}
          <input type="text" value={video} onChange={(e) => setVideo(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.live_room", { defaultValue: "Salle live (LiveKit)" })}
          <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("admin.published_label")}
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {t("admin.courses", { defaultValue: "Cours" })} {data && <span className="text-muted">({data.meta.total})</span>}
        </h2>
        <Button onClick={() => setEditing("new")}>{t("admin.add_course", { defaultValue: "Ajouter un cours" })}</Button>
      </div>

      {editing !== null && (
        <CourseForm
          key={editing === "new" ? "new" : editing.id}
          course={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_courses", { defaultValue: "Aucun cours." })} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.course_title", { defaultValue: "Titre" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_price")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("admin.col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPrice(c.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.is_published ? "bg-success/10 text-success" : "bg-page text-muted"}`}>
                      {c.is_published ? t("admin.published") : t("admin.draft")}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setEditing(c)} className="font-semibold text-primary hover:underline">{t("admin.edit")}</button>
                    <button type="button" onClick={() => toggle.mutate(c)} disabled={toggle.isPending} className="font-semibold text-muted hover:text-ink">
                      {c.is_published ? t("admin.unpublish") : t("admin.publish")}
                    </button>
                    <button type="button" onClick={() => handleDelete(c)} disabled={remove.isPending} className="font-semibold text-danger hover:underline">{t("admin.delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}