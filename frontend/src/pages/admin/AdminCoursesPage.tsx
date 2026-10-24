import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link as ExamLink } from "react-router-dom"
import { adminApi, type AdminCourse } from "../../api/admin"
import { apiClient } from "../../api/client"
import { useAuthStore } from "../../stores/authStore"
import { adminScopeOf } from "../../lib/adminPaths"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import CourseForm from "../../components/admin/CourseForm"
import { IconButton, Pill, Svg } from "../../components/admin/ui"
import { Avatar, Hero, ProgressBar, SearchBox, Segmented, heroBtn } from "../../components/admin/formationUi"
import { ICON } from "../../components/admin/formationIcons"


type CourseRow = AdminCourse & { enrollments_count?: number; completed_count?: number; avg_progress?: number | null }
type CoursesPage = { data: CourseRow[]; meta: { current_page: number; last_page: number; total: number } }

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
    const warn = n > 0 ? "\n\n" + t("px.crs.delete_warn", { n }) : ""
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
                  <span><strong className="text-base font-extrabold text-ink">{enrolled(c)}</strong> {enrolled(c) > 1 ? t("px.crs.enrolled_many") : t("px.crs.enrolled_one")}</span>
                  <span>{t("px.crs.avg", { n: avgPct(c) })}</span>
                </div>
                <ProgressBar value={avgPct(c)} />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5 border-t border-line pt-3">
                <IconButton label={t("admin.edit")} onClick={() => setEditing(c)}>
                  <Svg d={ICON.edit} className="h-4 w-4" />
                </IconButton>
                <ExamLink to={`/admin/formation/cours/${c.slug}/examen`} className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-black/5">
                  {t("exam.admin_link")}
                </ExamLink>
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


