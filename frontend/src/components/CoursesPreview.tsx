import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import CourseCard from "./CourseCard"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

// Apercu des formations sur l'accueil : n'affiche rien s'il n'y en a pas
export default function CoursesPreview() {
  const { t } = useTranslation()
  const owned = useOwnedCourses()
  const { data } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await catalogApi.courses()).data,
  })

  if (!data || data.data.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold sm:text-2xl">{t("courses.home_title")}</h2>
        <Link to="/formations" className="text-sm font-semibold text-primary">{t("courses.see_all")}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {data.data.slice(0, 3).map((course) => (
          <CourseCard key={course.id} course={course} enrollmentId={owned.get(course.id)} />
        ))}
      </div>
    </section>
  )
}