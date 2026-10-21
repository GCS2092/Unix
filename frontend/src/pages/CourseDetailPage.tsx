import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi } from "../api/courses"
import { enrollmentRequestsApi } from "../api/enrollmentRequests"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { formatPrice } from "../lib/format"
import { buttonClass } from "../components/buttonStyles"
import Button from "../components/Button"
import Gallery from "../components/Gallery"
import RichText from "../components/RichText"
import ProgramAccordion from "../components/ProgramAccordion"
import ShareButton from "../components/ShareButton"
import FaqAccordion from "../components/FaqAccordion"
import { ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-page/60 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold">{value}</dd>
    </div>
  )
}

export default function CourseDetailPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [message, setMessage] = useState("")

  const course = useQuery({
    queryKey: ["course-public", slug],
    queryFn: async () => (await coursesApi.bySlug(slug as string)).data.data,
    enabled: !!slug,
    retry: false,
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
    mutationFn: (courseId: number) => enrollmentRequestsApi.create(courseId, message.trim() || undefined),
    onSuccess: () => {
      toast.success(t("formation.sent"))
      setMessage("")
      void qc.invalidateQueries({ queryKey: ["my-enrollment-requests"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (course.isLoading) return <ListSkeleton rows={3} />
  if (course.error || !course.data) {
    return <ErrorState error={course.error ?? new Error(t("formation.not_found"))} onRetry={() => void course.refetch()} />
  }

  const c = course.data
  const enrollment = mine.data?.find((e) => e.course?.id === c.id)
  const req = requests.data?.find((r) => r.course_id === c.id)
  const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
  const minutes = c.duration_seconds ? Math.round(c.duration_seconds / 60) : 0
  const duration = minutes > 0
    ? minutes >= 60
      ? t("formation.hours", { h: Math.floor(minutes / 60), m: minutes % 60 })
      : t("formation.minutes", { n: minutes })
    : null
  const images = c.images && c.images.length > 0 ? c.images : c.image_url ? [c.image_url] : []
  const hasPrice = typeof c.price === "number" && c.price > 0

  let action
  if (!user) {
    action = (
      <div className="space-y-3">
        <Link to="/connexion" state={{ from: `/formations/${slug}` }} className={buttonClass({})}>{t("formation.login_to_enroll")}</Link>
        <p className="text-sm text-muted">
          {t("px.share.no_account", { defaultValue: "Pas encore de compte ?" })}{" "}
          <Link to={`/formations/inscription?cours=${encodeURIComponent(slug ?? "")}`} className="font-semibold text-primary hover:underline">{t("auth.create_account")}</Link>
        </p>
      </div>
    )
  } else if (enrollment) {
    action = (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-primary">{t("formation.enrolled")}</p>
        <Link to={`/etudiant/cours/${enrollment.id}`} className={buttonClass({})}>{t("formation.open")}</Link>
      </div>
    )
  } else {
    const form = (
      <div className="space-y-3">
        <h2 className="font-semibold">{t("formation.request_title")}</h2>
        <p className="text-sm text-muted">{t("formation.request_hint")}</p>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("formation.message_label")}</span>
          <textarea
            rows={3}
            maxLength={500}
            value={message}
            placeholder={t("formation.message_ph")}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <Button loading={ask.isPending} onClick={() => ask.mutate(c.id)}>{t("formation.send")}</Button>
      </div>
    )

    if (req?.status === "pending") {
      action = (
        <div className="space-y-1" role="status">
          <p className="font-semibold">{t("formation.pending")}</p>
          <p className="text-sm text-muted">
            {t("formation.pending_since", { date: new Date(req.created_at).toLocaleDateString(i18n.language) })}
          </p>
        </div>
      )
    } else {
      action = (
        <div className="space-y-5">
          {req?.status === "rejected" && (
            <div role="status" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              <p className="font-semibold">{t("formation.rejected")}</p>
              {req.decision_note && <p className="mt-1">{t("formation.reason", { note: req.decision_note })}</p>}
              <p className="mt-1">{t("formation.retry")}</p>
            </div>
          )}
          {c.product_slug && (
            <div className="space-y-2">
              <Link to={`/boutique/${c.product_slug}`} className={buttonClass({})}>{t("formation.buy")}</Link>
              <p className="text-sm text-muted">{t("formation.or_request")}</p>
            </div>
          )}
          {form}
        </div>
      )
    }
  }

  const perks = [
    c.has_quiz && t("formation.has_exam"),
    c.has_live && t("formation.has_live"),
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-6">
      <Link to="/etudiant/catalogue" className="text-sm font-semibold text-primary">← {t("formation.back")}</Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Gallery images={images} alt={c.title} />

          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
              {c.share_url && <ShareButton url={c.share_url} title={c.title} />}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.teacher && <Fact label={t("formation.teacher")} value={c.teacher} />}
              {duration && <Fact label={t("formation.duration")} value={duration} />}
              {hasPrice && <Fact label={t("formation.price")} value={formatPrice(c.price as number)} />}
            </dl>
          </div>

          {c.description && (
            <section className={card}>
              <h2 className="mb-3 text-lg font-bold">{t("px.crs.about", { defaultValue: "À propos de cette formation" })}</h2>
              <RichText text={c.description} />
            </section>
          )}

          {c.objectives && (
            <section className={card}>
              <h2 className="mb-3 text-lg font-bold">{t("formation.objectives")}</h2>
              <RichText text={c.objectives} />
            </section>
          )}

          {c.program && (
            <section className={card}>
              <h2 className="mb-3 text-lg font-bold">{t("formation.program")}</h2>
              <ProgramAccordion text={c.program} />
            </section>
          )}

          {(c.audience || c.prerequisites) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {c.audience && (
                <section className={card}>
                  <h2 className="mb-3 text-lg font-bold">{t("formation.audience")}</h2>
                  <RichText text={c.audience} />
                </section>
              )}
              {c.prerequisites && (
                <section className={card}>
                  <h2 className="mb-3 text-lg font-bold">{t("formation.prerequisites")}</h2>
                  <RichText text={c.prerequisites} />
                </section>
              )}
            </div>
          )}

          {perks.length > 0 && (
            <section className={card}>
              <h2 className="mb-3 text-lg font-bold">{t("px.crs.included", { defaultValue: "Ce que vous obtenez" })}</h2>
              <ul className="space-y-2 text-sm">
                {perks.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden="true" className="font-bold text-success">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <FaqAccordion space="formation" compact courseId={c.id} />
        </div>

        <aside id="inscription" className="h-fit scroll-mt-24 lg:sticky lg:top-24">
          <div className={card}>
            {hasPrice && <p className="mb-4 text-3xl font-extrabold text-primary">{formatPrice(c.price as number)}</p>}
            {action}
          </div>
        </aside>
      </div>

      {!enrollment && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            {hasPrice && <p className="text-xl font-extrabold text-primary">{formatPrice(c.price as number)}</p>}
            <a href="#inscription" className={`${buttonClass({})} min-w-0 flex-1 justify-center`}>
              {t("px.crs.cta", { defaultValue: "S'inscrire" })}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}