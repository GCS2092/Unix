import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi } from "../api/courses"
import { useAuthStore } from "../stores/authStore"
import { getErrorMessage } from "../lib/errors"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { buttonClass } from "../components/Button"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export default function CoursesPage() {
  const { t } = useTranslation()
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

  const enrollmentByCourse = new Map<number, number>()
  mine.data?.forEach((e) => { if (e.course) enrollmentByCourse.set(e.course.id, e.id) })

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
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.data.map((c) => {
            const enrollmentId = enrollmentByCourse.get(c.id)
            return (
              <li key={c.id} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{c.title}</h2>
                  {enrollmentId && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{t("learn.enrolled")}</span>
                  )}
                </div>
                {c.description && <p className="mt-2 line-clamp-4 flex-1 text-sm text-muted">{c.description}</p>}
                <div className="mt-4">
                  {enrollmentId ? (
                    <Link to={`/mes-cours/${enrollmentId}`} className={buttonClass({ size: "sm" })}>{t("learn.open")}</Link>
                  ) : WHATSAPP_NUMBER ? (
                    <a href={whatsappUrl(t("learn.wa_message", { title: c.title }))} target="_blank" rel="noopener noreferrer"
                      className={buttonClass({ size: "sm", variant: "secondary" })}>
                      {t("learn.request_access")}
                    </a>
                  ) : null}
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