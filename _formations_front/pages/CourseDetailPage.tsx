import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "../components/AddToCartButton"
import { buttonClass } from "../components/Button"
import { CourseCover } from "../components/CourseCard"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

function CourseAction({ courseId, enrollmentId }: { courseId: number; enrollmentId?: number }) {
  const { t } = useTranslation()
  if (enrollmentId !== undefined) {
    return <Link to={`/mes-formations/${enrollmentId}`} className={buttonClass({ full: true })}>{t("courses.access")}</Link>
  }
  return <AddToCartButton type="course" id={courseId} />
}

export default function CourseDetailPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const owned = useOwnedCourses()
  const { slug = "" } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => (await catalogApi.course(slug)).data.data,
    enabled: slug !== "",
  })

  if (isLoading) return <ProductDetailSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const enrollmentId = owned.get(data.id)

  return (
    <div className="pb-24 lg:pb-0">
      <Link to="/formations" className="inline-flex min-h-[44px] items-center text-sm text-muted hover:text-ink">
        â† {t("courses.back")}
      </Link>
      <div className="mt-2 grid gap-6 lg:mt-4 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <CourseCover className="aspect-[4/3] rounded-card shadow-card sm:aspect-video" />
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{data.title}</h1>
          {enrollmentId !== undefined ? (
            <p className="mt-2 text-sm font-semibold text-primary lg:hidden">{t("courses.owned")}</p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-primary lg:hidden">{formatPrice(data.price)}</p>
          )}
          <h2 className="mt-6 text-lg font-semibold">{t("courses.description")}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">
            {data.description || t("courses.no_description")}
          </p>
        </div>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          {enrollmentId !== undefined ? (
            <p className="text-sm font-semibold text-primary">{t("courses.owned")}</p>
          ) : (
            <p className="text-3xl font-extrabold text-primary">{formatPrice(data.price)}</p>
          )}
          <div className="mt-4">
            <CourseAction courseId={data.id} enrollmentId={enrollmentId} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          {enrollmentId === undefined && <p className="text-xl font-extrabold text-primary">{formatPrice(data.price)}</p>}
          <div className="flex-1">
            <CourseAction courseId={data.id} enrollmentId={enrollmentId} />
          </div>
        </div>
      </div>
    </div>
  )
}