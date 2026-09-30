import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import AddToCartButton from "./AddToCartButton"
import { buttonClass } from "./Button"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Course } from "../types"

export function CourseCover({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-linear-to-br from-primary to-primary-dark text-primary-light ${className}`}>
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8l9-4 9 4-9 4-9-4z" />
        <path d="M7 10.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-5.5" />
        <path d="M21 8v6" />
      </svg>
    </div>
  )
}

interface Props {
  course: Course
  enrollmentId?: number
}

export default function CourseCard({ course, enrollmentId }: Props) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-lg">
      <Link to={`/formations/${course.slug}`} className="block" aria-label={course.title}>
        <CourseCover className="aspect-video" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link to={`/formations/${course.slug}`} className="line-clamp-2 text-base font-semibold hover:text-primary">
          {course.title}
        </Link>
        {course.description && <p className="line-clamp-2 text-sm text-muted">{course.description}</p>}
        <p className="text-lg font-extrabold text-primary">{formatPrice(course.price)}</p>
        <div className="mt-auto pt-1">
          {enrollmentId !== undefined ? (
            <Link to={`/mes-formations/${enrollmentId}`} className={buttonClass({ full: true })}>{t("courses.access")}</Link>
          ) : (
            <AddToCartButton type="course" id={course.id} />
          )}
        </div>
      </div>
    </article>
  )
}