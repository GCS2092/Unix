import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import { buttonClass } from "../components/Button"
import ProductImage from "../components/ProductImage"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { getErrorMessage } from "../lib/errors"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import type { Product } from "../types"

function Svg({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const SHIELD = "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4"
const TRUCK = "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
const HEADSET = "M4 13v-1a8 8 0 0116 0v1M4 13h3v5H5a1 1 0 01-1-1v-4zM20 13h-3v5h2a1 1 0 001-1v-4z"
const CHAT = "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z"
const PLUS = "M12 5v14M5 12h14"
const CHECK = "M5 12l5 5 9-10"
const ARROW = "M9 6l6 6-6 6"

function MiniCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const add = useCartStore((s) => s.add)
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const soldOut = product.in_stock === false
  const src = product.images?.[0] ?? product.image_url

  useEffect(() => {
    if (status !== "done") return
    const timer = setTimeout(() => setStatus("idle"), 1500)
    return () => clearTimeout(timer)
  }, [status])

  async function handleAdd() {
    setStatus("loading")
    try {
      await add("product", product.id, 1)
      setStatus("done")
      if ("vibrate" in navigator) navigator.vibrate(12)
      toast.success(t("product.added_toast"))
    } catch (e) {
      toast.error(getErrorMessage(e))
      setStatus("idle")
    }
  }

  return (
    <article className="w-[156px] flex-none snap-start overflow-hidden rounded-card border border-line bg-surface shadow-card sm:w-auto">
      <Link to={"/boutique/" + product.slug} className="block">
        <ProductImage src={src} alt={product.name} ratio="aspect-[4/5]" imgClassName={soldOut ? "grayscale" : ""} />
      </Link>
      <div className="p-3">
        <Link to={"/boutique/" + product.slug} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium hover:text-primary">
          {product.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-bold text-primary">{formatPrice(product.price)}</p>
          {soldOut ? (
            <span className="text-xs text-muted">{t("ux.out_of_stock")}</span>
          ) : (
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={status === "loading"}
              aria-label={t("product.add")}
              className={"flex h-9 w-9 flex-none items-center justify-center rounded-full text-white transition active:scale-90 disabled:opacity-60 " + (status === "done" ? "bg-primary-dark" : "bg-primary hover:bg-primary-dark")}
            >
              <Svg d={status === "done" ? CHECK : PLUS} className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await catalogApi.products()).data,
  })

  const trust = [
    { d: SHIELD, label: en ? "Secure payment" : "Paiement sécurisé" },
    { d: TRUCK, label: en ? "Delivery or pickup" : "Livraison ou retrait" },
    { d: HEADSET, label: en ? "Help on WhatsApp" : "Aide sur WhatsApp" },
  ]

  const waGeneral = whatsappUrl(en ? "Hello, I have a question about your products." : "Bonjour, j'ai une question sur vos produits.")

  return (
    <div className="space-y-8 sm:space-y-12">
      <section className="relative overflow-hidden rounded-card bg-linear-to-br from-primary to-primary-dark px-5 py-9 text-white shadow-card-lg sm:px-8 sm:py-14 sm:text-center">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/10" />
        <h1 className="relative max-w-2xl text-3xl font-extrabold sm:mx-auto sm:text-4xl">{t("home.title")}</h1>
        <p className="relative mt-3 max-w-xl text-primary-light sm:mx-auto">{t("home.subtitle")}</p>
        <div className="relative mt-7 flex gap-2 sm:justify-center">
          <Link
            to="/boutique"
            className={buttonClass({ variant: "secondary", size: "lg", className: "border-transparent !text-primary-dark" })}
          >
            {t("home.browse")}
          </Link>
          {WHATSAPP_NUMBER && (
            <a
              href={waGeneral}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={en ? "Write on WhatsApp" : "Écrire sur WhatsApp"}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-lg border border-white/60 text-white transition hover:bg-white/10 active:scale-95"
            >
              <Svg d={CHAT} className="h-6 w-6" />
            </a>
          )}
        </div>
      </section>

      <ul className="grid grid-cols-3 gap-2 sm:gap-4">
        {trust.map((item) => (
          <li key={item.label} className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface px-2 py-3 text-center text-xs leading-snug text-ink/80 shadow-card sm:flex-row sm:justify-center sm:gap-3 sm:py-4 sm:text-sm">
            <span className="text-primary"><Svg d={item.d} className="h-6 w-6" /></span>
            {item.label}
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold sm:text-2xl">{t("home.new")}</h2>
          <Link to="/boutique" className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
            {en ? "See all" : "Voir tout"}
            <Svg d={ARROW} className="h-4 w-4" />
          </Link>
        </div>
        {isLoading && <ProductGridSkeleton count={4} />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.data.length === 0 && <EmptyState message={t("shop.empty")} />}
        {data && data.data.length > 0 && (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {data.data.slice(0, 8).map((product) => (
              <MiniCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}