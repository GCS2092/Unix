import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi } from "../api/courses"
import { useAuthStore } from "../stores/authStore"
import { useLiveStatus } from "../lib/useLiveStatus"
import { useLiveText } from "../lib/liveText"
import LiveRoom from "../components/LiveRoom"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export default function LiveJoinPage() {
  const { courseId } = useParams()
  const id = Number(courseId)
  const valid = Number.isInteger(id) && id > 0
  const { t } = useTranslation()
  const L = useLiveText()
  const user = useAuthStore((s) => s.user)
  const status = useLiveStatus()
  const mine = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => (await coursesApi.mine()).data.data,
    enabled: valid,
  })

  if (!valid) return <EmptyState message={t("common.not_found")} actionTo="/etudiant" actionLabel={t("learn.back")} />
  if (mine.isLoading) return <ListSkeleton rows={2} />
  if (mine.error) return <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />

  const enrollment = (mine.data ?? []).find((e) => e.course?.id === id)
  if (!enrollment && !user?.is_admin) {
    return <EmptyState message={L.notEnrolled} actionTo="/etudiant/catalogue" actionLabel={t("learn.see_catalog")} />
  }

  const title = enrollment?.course?.title ?? status.items.find((i) => i.course_id === id)?.title ?? ""

  return (
    <div>
      <Link to="/etudiant" className="text-sm font-semibold text-primary">&larr; {t("learn.back")}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold sm:text-2xl">{title}</h1>
      <LiveRoom courseId={id} live={status.isLive(id)} />
    </div>
  )
}