import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import ProductCard from "../components/ProductCard"
import { buttonClass } from "../components/Button"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import CoursesPreview from "../components/CoursesPreview"

export default function HomePage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await catalogApi.products()).data,
  })

  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="rounded-card bg-linear-to-br from-primary to-primary-dark px-5 py-10 text-center text-white shadow-card-lg sm:px-6 sm:py-14">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">{t("home.title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-primary-light">{t("home.subtitle")}</p>
        <Link
          to="/boutique"
          className={buttonClass({ variant: "secondary", size: "lg", className: "mt-8 border-transparent !text-primary-dark" })}
        >
          {t("home.browse")}
        </Link>
      </section>

      <CoursesPreview />

      <section>
        <h2 className="mb-4 text-xl font-bold sm:text-2xl">{t("home.new")}</h2>
        {isLoading && <ProductGridSkeleton count={4} />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.data.length === 0 && <EmptyState message={t("shop.empty")} />}
        {data && data.data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.data.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}