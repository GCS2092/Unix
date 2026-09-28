import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "../components/AddToCartButton"
import ProductImage from "../components/ProductImage"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"

export default function ProductDetailPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const { slug = "" } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await catalogApi.product(slug)).data.data,
    enabled: slug !== "",
  })

  if (isLoading) return <ProductDetailSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  return (
    <div className="pb-24 lg:pb-0">
      <Link to="/boutique" className="inline-flex min-h-[44px] items-center text-sm text-muted hover:text-ink">
        ← {t("product.back")}
      </Link>
      <div className="mt-2 grid gap-6 lg:mt-4 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <ProductImage
            src={data.image_url}
            alt={data.name}
            ratio="aspect-[4/3] sm:aspect-video"
            className="rounded-card shadow-card"
            priority
          />
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{data.name}</h1>
          <p className="mt-2 text-2xl font-extrabold text-primary lg:hidden">{formatPrice(data.price)}</p>
          <h2 className="mt-6 text-lg font-semibold">{t("product.description")}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">
            {data.description || t("product.no_description")}
          </p>
        </div>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          <p className="text-3xl font-extrabold text-primary">{formatPrice(data.price)}</p>
          <div className="mt-4">
            <AddToCartButton type="product" id={data.id} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <p className="text-xl font-extrabold text-primary">{formatPrice(data.price)}</p>
          <div className="flex-1">
            <AddToCartButton type="product" id={data.id} />
          </div>
        </div>
      </div>
    </div>
  )
}