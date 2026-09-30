import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { downloadCertificate } from "../api/enrollments"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button, { buttonClass } from "../components/Button"
import ProgressBar from "../components/ProgressBar"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import { useEnrollments } from "../hooks/useOwnedCourses"
import type { Enrollment } from "../types"

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const { t } = useTranslation()
  const completed = enrollment.progress >= 100 || !!enrollment.completed_at
  const cert = enrollment.certificate ?? null
  const action = completed ? t("courses.review") : enrollment.progress > 0 ? t("courses.continue") : t("courses.start")

  async function handleDownload(id: number) {
    try {
      await downloadCertificate(id)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold">{enrollment.course?.title ?? t("courses.title")}</p>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${completed ? "bg-primary/10 text-primary" : "bg-line text-muted"}`}>
          {completed ? t("courses.completed") : t("courses.in_progress")}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={enrollment.progress} />
        <span className="w-10 shrink-0 text-right text-sm text-muted">{Math.round(enrollment.progress)}%</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to={`/mes-formations/${enrollment.id}`} className={buttonClass({ className: "w-full sm:w-auto" })}>{action}</Link>
        {cert && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void handleDownload(cert.id)}>
            {t("courses.certificate_download")}
          </Button>
        )}
      </div>
    </li>
  )
}

export default function MyCoursesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useEnrollments()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("courses.my_title")}</h1>
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("courses.my_empty")} actionTo="/formations" actionLabel={t("courses.browse")} />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </ul>
      )}
    </div>
  )
}