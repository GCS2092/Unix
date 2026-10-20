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
import { ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

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

  let action
  if (!user) {
    action = <Link to="/connexion" className={buttonClass({})}>{t("formation.login_to_enroll")}</Link>
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link to="/etudiant/catalogue" className="text-sm font-semibold text-primary">← {t("formation.back")}</Link>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>

      <div className={card}>
        {c.description && <p className="whitespace-pre-line text-sm">{c.description}</p>}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {c.teacher && <div><dt className="text-muted">{t("formation.teacher")}</dt><dd className="font-semibold">{c.teacher}</dd></div>}
          {duration && <div><dt className="text-muted">{t("formation.duration")}</dt><dd className="font-semibold">{duration}</dd></div>}
          {typeof c.price === "number" && c.price > 0 && (
            <div><dt className="text-muted">{t("formation.price")}</dt><dd className="font-semibold">{formatPrice(c.price)}</dd></div>
          )}
        </dl>
        {(c.has_quiz || c.has_live) && (
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {c.has_quiz && <li>✓ {t("formation.has_exam")}</li>}
            {c.has_live && <li>✓ {t("formation.has_live")}</li>}
          </ul>
        )}
      </div>

      <div className={card}>{action}</div>
    </div>
  )
}