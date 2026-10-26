import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "../components/AddToCartButton"
import Gallery from "../components/Gallery"
import RichText from "../components/RichText"
import SpecsTable from "../components/SpecsTable"
import FaqAccordion from "../components/FaqAccordion"
import QuantityStepper from "../components/QuantityStepper"
import BackLink from "../components/BackLink"
import StockBadge from "../components/StockBadge"
import WhatsAppButton from "../components/WhatsAppButton"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import RecentlyViewed from "../components/RecentlyViewed"
import Suggestions from "../components/Suggestions"
import { useRecentStore } from "../stores/recentStore"

export default function ProductDetailPage() {
  const { t, i18n } = useTranslation()
  const formatPrice = useFormatPrice()
  const { slug = "" } = useParams()
  const [qty, setQty] = useState(1)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await catalogApi.product(slug)).data.data,
    enabled: slug !== "",
  })

  // Memorise ce produit dans "Vus récemment" (sur l'appareil du client)
  useEffect(() => {
    if (!data) return
    useRecentStore.getState().push({
      id: data.id,
      slug: data.slug,
      name: data.name,
      price: data.price,
      image: data.images?.[0] ?? data.image_url ?? null,
      in_stock: data.in_stock,
    })
  }, [data])
  if (isLoading) return <ProductDetailSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const soldOut = data.in_stock === false
  const gallery = data.images && data.images.length > 0 ? data.images : data.image_url ? [data.image_url] : []
  const max = typeof data.low_stock === "number" ? data.low_stock : 99
  const en = i18n.language.startsWith("en")
  const extra = data as unknown as { specs?: string | null; delivery_info?: string | null }
  const quantity = Math.min(qty, max)
  const url = data.share_url ?? `${window.location.origin}/boutique/${data.slug}`

  // Meme rangee dans la barre collee et dans le plein ecran : prix, ajout, WhatsApp carre
  const buyRow = (
    <div className="flex items-center gap-3">
      <p className="text-xl font-extrabold text-primary">{formatPrice(data.price * quantity)}</p>
      <div className="min-w-0 flex-1">
        <AddToCartButton type="product" id={data.id} quantity={quantity} inStock={data.in_stock} />
      </div>
      <WhatsAppButton productName={data.name} productUrl={url} soldOut={soldOut} display="icon" />
    </div>
  )

  return (
    <div className="pb-24 lg:pb-0">
      <BackLink to="/boutique">{t("product.back")}</BackLink>
      <div className="mt-2 grid gap-6 lg:mt-4 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <Gallery images={gallery} thumbs={(data as unknown as { thumbs?: string[] }).thumbs} alt={data.name} footer={buyRow} />
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
            <WhatsAppButton productName={data.name} productUrl={url} soldOut={soldOut} display="link" className="!justify-start !px-0" />
          </div>
          <h2 data-tour="pd-desc" className="mt-6 text-lg font-semibold">{t("product.description")}</h2>
          <div className="mt-3">
            {data.description ? <RichText text={data.description} /> : <p className="text-muted">{t("product.no_description")}</p>}
          </div>
          {extra.specs && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">{en ? "Specifications" : "Caractéristiques"}</h2>
              <SpecsTable text={extra.specs} />
            </section>
          )}
          {extra.delivery_info && (
            <section className="mt-8 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
              <h2 className="mb-3 text-lg font-semibold">{en ? "Delivery and returns" : "Livraison et retours"}</h2>
              <RichText text={extra.delivery_info} />
            </section>
          )}
          <div className="mt-10"><FaqAccordion space="shop" compact productId={data.id} /></div>
        </div>

        <aside data-tour="pd-buy" className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
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
            <WhatsAppButton productName={data.name} productUrl={url} soldOut={soldOut} display="link" />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div data-tour="pd-buy-bar" className="mx-auto max-w-6xl">{buyRow}</div>
      </div>
      <div className="mt-10"><Suggestions excludeIds={[data.id]} /></div>
      <div className="mt-10"><RecentlyViewed excludeSlug={data.slug} /></div>
    </div>
  )
}



