import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import CourseCard from "../components/CourseCard"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

export default function CoursesPage() {
  const { t } = useTranslation()
  const owned = useOwnedCourses()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await catalogApi.courses()).data,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("courses.title")}</h1>
      {isLoading && <ProductGridSkeleton count={6} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("courses.empty")} />}
      {data && data.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {data.data.map((course) => (
            <CourseCard key={course.id} course={course} enrollmentId={owned.get(course.id)} />
          ))}
        </div>
      )}
    </div>
  )
}