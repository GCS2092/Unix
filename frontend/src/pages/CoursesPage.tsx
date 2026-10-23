import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi } from "../api/courses"
import { enrollmentRequestsApi, type RequestStatus } from "../api/enrollmentRequests"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { formatPrice } from "../lib/format"
import { plain } from "../lib/plain"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { buttonClass } from "../components/buttonStyles"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export default function CoursesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"all" | "mine" | "open">("all")

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

  const visible = (catalog.data ?? []).filter((c) => {
    if (search.trim() && !c.title.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (tab === "mine") return enrollmentByCourse.has(c.id)
    if (tab === "open") return !enrollmentByCourse.has(c.id)
    return true
  })

  const durationOf = (seconds?: number | null) => {
    const m = seconds ? Math.round(seconds / 60) : 0
    if (m <= 0) return null
    return m >= 60 ? t("formation.hours", { h: Math.floor(m / 60), m: m % 60 }) : t("formation.minutes", { n: m })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("learn.catalog_title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{t("learn.catalog_intro")}</p>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("px.cat.search", { defaultValue: "Rechercher un cours" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {([["all", "Tous"], ["mine", "Mes cours"], ["open", "À découvrir"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-[40px] whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
                tab === k ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {t(`px.cat.tab_${k}`, { defaultValue: label })}
            </button>
          ))}
        </div>
      </div>

      {catalog.isLoading && <ListSkeleton />}
      {mine.error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(mine.error)}</p>}
      {catalog.error && <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />}
      {catalog.data && catalog.data.length === 0 && (
        <EmptyState message={t("learn.catalog_empty")} actionTo="/boutique" actionLabel={t("cart.go_shop")} />
      )}

      {catalog.data && catalog.data.length > 0 && visible.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">{t("px.cat.none", { defaultValue: "Aucun cours ne correspond." })}</p>
      )}

      {catalog.data && visible.length > 0 && (
        <ul data-tour="co-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const enrollmentId = enrollmentByCourse.get(c.id)
            const status = statusByCourse.get(c.id)
            const pending = status === "pending"
            const duration = durationOf(c.duration_seconds)
            const price = typeof c.price === "number" && c.price > 0 ? formatPrice(c.price) : null
            const meta = [c.teacher, duration, price].filter(Boolean).join(" · ")
            const desc = plain(c.description, 180)
            return (
              <li key={c.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <Link to={`/formations/${c.slug}`} tabIndex={-1} aria-hidden="true" className="block">
                  {c.image_url
                    ? <img src={c.image_url} alt="" loading="lazy" className="h-36 w-full object-cover" />
                    : <div className="h-36 w-full bg-gradient-to-br from-primary/80 to-primary-dark" />}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold"><Link to={`/formations/${c.slug}`} className="hover:text-primary hover:underline">{c.title}</Link></h2>
                    {enrollmentId && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{t("learn.enrolled")}</span>
                    )}
                    {!enrollmentId && pending && (
                      <span className="shrink-0 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-ink">
                        {t("px.req.pending", { defaultValue: "En attente" })}
                      </span>
                    )}
                  </div>
                  {meta && <p className="mt-1 text-xs font-medium text-muted">{meta}</p>}
                  {desc && <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{desc}</p>}
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
                        {c.product_slug && (
                          <Link to={`/boutique/${c.product_slug}`} className={buttonClass({ size: "sm" })}>{t("formation.buy")}</Link>
                        )}
                        <button
                          type="button"
                          className={buttonClass({ size: "sm", variant: c.product_slug ? "secondary" : undefined })}
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