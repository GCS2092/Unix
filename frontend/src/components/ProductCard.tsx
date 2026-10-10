import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "./AddToCartButton"
import ImageCarousel from "./ImageCarousel"
import StockBadge from "./StockBadge"
import WhatsAppButton from "./WhatsAppButton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Product } from "../types"

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

function isRecent(createdAt: string) {
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) && Date.now() - time < FOURTEEN_DAYS
}

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const queryClient = useQueryClient()
  const soldOut = product.in_stock === false
  const fresh = isRecent(product.created_at)
  const url = product.share_url ?? `${window.location.origin}/boutique/${product.slug}`
  const images = product.images && product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : []
  const prefetch = () =>
    void queryClient.prefetchQuery({
      queryKey: ["product", product.slug],
      queryFn: async () => (await catalogApi.product(product.slug)).data.data,
      staleTime: 60_000,
    })

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-lg"
      onPointerEnter={prefetch}
      onTouchStart={prefetch}
    >
      <ImageCarousel
        images={images}
        alt={product.name}
        to={`/boutique/${product.slug}`}
        ratio="aspect-[4/5]"
        imgClassName={soldOut ? "grayscale" : ""}
      >
        <StockBadge inStock={product.in_stock} lowStock={product.low_stock} className="pointer-events-none absolute left-2 top-2" />
        {fresh && !soldOut && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-primary-dark px-2.5 py-1 text-xs font-semibold text-white">
            {t("ux.new_badge")}
          </span>
        )}
      </ImageCarousel>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link to={`/boutique/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold hover:text-primary sm:text-base">
          {product.name}
        </Link>
        <p className="text-lg font-extrabold text-primary">{formatPrice(product.price)}</p>
        <div className="mt-auto pt-1">
          <AddToCartButton type="product" id={product.id} inStock={product.in_stock} />
          <WhatsAppButton productName={product.name} productUrl={url} soldOut={soldOut} display="linkShort" className="mt-1.5" />
        </div>
      </div>
    </article>
  )
}