import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi, downloadCertificate, type Enrollment } from "../api/courses"
import { toast } from "../stores/toastStore"
import { buttonClass } from "../components/Button"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  )
}

function CertificateButton({ enrollment }: { enrollment: Enrollment }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const issue = useMutation({
    mutationFn: () => coursesApi.issueCertificate(enrollment.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-enrollments"] }),
    onError: () => toast.error(t("learn.certificate_error")),
  })
  const cls = buttonClass({ size: "sm", variant: "secondary" })

  if (enrollment.certificate) {
    return (
      <button type="button" className={cls}
        onClick={() => void downloadCertificate(enrollment.certificate!.id).catch(() => toast.error(t("learn.certificate_error")))}>
        {t("learn.certificate_download")}
      </button>
    )
  }
  return (
    <button type="button" className={cls} disabled={issue.isPending} onClick={() => issue.mutate()}>
      {t("learn.certificate_get")}
    </button>
  )
}

export default function MyCoursesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => (await coursesApi.mine()).data.data,
    staleTime: 0,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("learn.my_title")}</h1>
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("learn.my_empty")} actionTo="/formations" actionLabel={t("learn.see_catalog")} />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((e) => {
            const done = e.progress >= 100 || !!e.completed_at
            return (
              <li key={e.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold">{e.course?.title}</h2>
                  {done && <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{t("learn.completed")}</span>}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{t("learn.progress")}</span><span>{e.progress}%</span>
                  </div>
                  <Bar value={e.progress} />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link to={`/mes-cours/${e.id}`} className={buttonClass({ size: "sm" })}>
                    {done ? t("learn.review") : e.progress > 0 ? t("learn.continue") : t("learn.start")}
                  </Link>
                  {done && <CertificateButton enrollment={e} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}