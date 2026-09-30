import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "../components/AddToCartButton"
import ImageZoom from "../components/ImageZoom"
import ProductImage from "../components/ProductImage"
import QuantityStepper from "../components/QuantityStepper"
import BackLink from "../components/BackLink"
import StockBadge from "../components/StockBadge"
import WhatsAppButton from "../components/WhatsAppButton"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"

export default function ProductDetailPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const { slug = "" } = useParams()
  const [qty, setQty] = useState(1)
  const [imgIndex, setImgIndex] = useState(0)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await catalogApi.product(slug)).data.data,
    enabled: slug !== "",
  })

  if (isLoading) return <ProductDetailSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const soldOut = data.in_stock === false
  const gallery = data.images && data.images.length > 0 ? data.images : data.image_url ? [data.image_url] : []
  const max = typeof data.low_stock === "number" ? data.low_stock : 99
  const quantity = Math.min(qty, max)
  const url = data.share_url ?? `${window.location.origin}/boutique/${data.slug}`

  // Meme rangee dans la barre collee et dans le plein ecran : prix, ajout, WhatsApp carre
  const buyRow = (
    <div className="flex items-center gap-3">
      <p className="text-xl font-extrabold text-primary">{formatPrice(data.price * quantity)}</p>
      <div className="min-w-0 flex-1">
        <AddToCartButton type="product" id={data.id} quantity={quantity} inStock={data.in_stock} />
      </div>
      <WhatsAppButton productName={data.name} productUrl={url} display="icon" />
    </div>
  )

  return (
    <div className="pb-24 lg:pb-0">
      <BackLink to="/boutique">{t("product.back")}</BackLink>
      <div className="mt-2 grid gap-6 lg:mt-4 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <ImageZoom
            src={gallery[imgIndex] ?? data.image_url}
            alt={data.name}
            ratio="aspect-[4/3] sm:aspect-video"
            className="rounded-card shadow-card"
            footer={buyRow}
          />
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {gallery.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setImgIndex(i)}
                  aria-label={`${data.name} ${i + 1}`}
                  aria-current={i === imgIndex}
                  className={`h-16 w-16 flex-none overflow-hidden rounded-lg border-2 transition sm:h-20 sm:w-20 ${
                    i === imgIndex ? "border-primary" : "border-line opacity-80 hover:opacity-100"
                  }`}
                >
                  <ProductImage src={src} alt="" ratio="aspect-square" compact />
                </button>
              ))}
            </div>
          )}
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{data.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 lg:hidden">
            <p className="text-2xl font-extrabold text-primary">{formatPrice(data.price)}</p>
            <StockBadge inStock={data.in_stock} lowStock={data.low_stock} />
          </div>
          {!soldOut && (
            <div className="mt-4 lg:hidden">
              <QuantityStepper value={quantity} onChange={setQty} max={max} />
            </div>
          )}
          <div className="mt-3 lg:hidden">
            <WhatsAppButton productName={data.name} productUrl={url} display="link" className="!justify-start !px-0" />
          </div>
          <h2 className="mt-6 text-lg font-semibold">{t("product.description")}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">
            {data.description || t("product.no_description")}
          </p>
        </div>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          <p className="text-3xl font-extrabold text-primary">{formatPrice(data.price)}</p>
          <StockBadge inStock={data.in_stock} lowStock={data.low_stock} className="mt-2" />
          {!soldOut && (
            <div className="mt-4">
              <QuantityStepper value={quantity} onChange={setQty} max={max} />
            </div>
          )}
          <div className="mt-4">
            <AddToCartButton type="product" id={data.id} quantity={quantity} inStock={data.in_stock} />
          </div>
          <div className="mt-2">
            <WhatsAppButton productName={data.name} productUrl={url} display="link" />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-6xl">{buyRow}</div>
      </div>
    </div>
  )
}



