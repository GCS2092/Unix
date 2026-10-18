import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi } from "../api/courses"
import { enrollmentRequestsApi, type RequestStatus } from "../api/enrollmentRequests"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { buttonClass } from "../components/buttonStyles"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export default function CoursesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const catalog = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => (await coursesApi.catalog()).data.data,
  })
  const mine = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => (await coursesApi.mine()).data.data,
    enabled: !!user,
  })
  const requests = useQuery({
    queryKey: ["my-enrollment-requests"],
    queryFn: async () => (await enrollmentRequestsApi.mine()).data.data,
    enabled: !!user,
    staleTime: 0,
  })

  const ask = useMutation({
    mutationFn: (courseId: number) => enrollmentRequestsApi.create(courseId),
    onSuccess: () => {
      toast.success(t("px.req.sent", { defaultValue: "Demande envoyée. Vous serez prévenu dès qu'elle sera traitée." }))
      void qc.invalidateQueries({ queryKey: ["my-enrollment-requests"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const enrollmentByCourse = new Map<number, number>()
  mine.data?.forEach((e) => { if (e.course) enrollmentByCourse.set(e.course.id, e.id) })

  const statusByCourse = new Map<number, RequestStatus>()
  requests.data?.forEach((r) => statusByCourse.set(r.course_id, r.status))

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("learn.catalog_title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{t("learn.catalog_intro")}</p>

      {catalog.isLoading && <ListSkeleton />}
      {mine.error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(mine.error)}</p>}
      {catalog.error && <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />}
      {catalog.data && catalog.data.length === 0 && (
        <EmptyState message={t("learn.catalog_empty")} actionTo="/boutique" actionLabel={t("cart.go_shop")} />
      )}

      {catalog.data && catalog.data.length > 0 && (
        <ul data-tour="co-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.data.map((c) => {
            const enrollmentId = enrollmentByCourse.get(c.id)
            const status = statusByCourse.get(c.id)
            const pending = status === "pending"
            return (
              <li key={c.id} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{c.title}</h2>
                  {enrollmentId && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{t("learn.enrolled")}</span>
                  )}
                  {!enrollmentId && pending && (
                    <span className="shrink-0 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-ink">
                      {t("px.req.pending", { defaultValue: "En attente" })}
                    </span>
                  )}
                </div>
                {c.description && <p className="mt-2 line-clamp-4 flex-1 text-sm text-muted">{c.description}</p>}
                {!enrollmentId && status === "rejected" && (
                  <p className="mt-2 text-xs text-danger">
                    {t("px.req.rejected", { defaultValue: "Votre dernière demande n'a pas été acceptée. Vous pouvez en refaire une." })}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {enrollmentId ? (
                    <Link to={`/etudiant/cours/${enrollmentId}`} className={buttonClass({ size: "sm" })}>{t("learn.open")}</Link>
                  ) : pending ? (
                    <span className="text-sm text-muted">{t("px.req.pending_hint", { defaultValue: "Demande envoyée, en cours d'examen." })}</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={buttonClass({ size: "sm" })}
                        disabled={ask.isPending}
                        onClick={() => ask.mutate(c.id)}
                      >
                        {t("learn.request_access")}
                      </button>
                      {WHATSAPP_NUMBER && (
                        <a href={whatsappUrl(t("learn.wa_message", { title: c.title }))} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-semibold text-primary hover:underline">
                          WhatsApp
                        </a>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!user && <p className="mt-6 text-sm text-muted">{t("learn.login_to_see")} <Link to="/connexion" className="font-semibold text-primary">{t("nav.login")}</Link></p>}
    </div>
  )
}
