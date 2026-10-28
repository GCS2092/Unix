import { useShopName } from "../hooks/usePublicShop"
import { useEffect, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import { aboutApi } from "../api/about"
import { coursesApi } from "../api/courses"
import { shippingApi } from "../api/shipping"
import { buttonClass } from "../components/buttonStyles"
import ProductImage from "../components/ProductImage"
import StockBadge from "../components/StockBadge"
import { EmptyState, ErrorState } from "../components/States"
import { HomeRowSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { getErrorMessage } from "../lib/errors"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import RecentlyViewed from "../components/RecentlyViewed"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { useDrawerStore } from "../stores/drawerStore"
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
const SEARCH = "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const isRecent = (createdAt: string) => {
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) && Date.now() - time < FOURTEEN_DAYS
}

function MiniCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const add = useCartStore((s) => s.add)
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const soldOut = product.in_stock === false
  const fresh = isRecent(product.created_at)
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
      useDrawerStore.getState().show()
    } catch (e) {
      toast.error(getErrorMessage(e))
      setStatus("idle")
    }
  }

  return (
    <article className="w-[156px] flex-none snap-start overflow-hidden rounded-card border border-line bg-surface shadow-card sm:w-auto">
      <Link to={"/boutique/" + product.slug} className="relative block">
        <ProductImage src={src} alt={product.name} ratio="aspect-square" fit="contain" imgClassName={soldOut ? "grayscale" : ""} />
        <StockBadge inStock={product.in_stock} lowStock={product.low_stock} className="pointer-events-none absolute left-2 top-2" />
        {fresh && !soldOut && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-ink">
            {t("ux.new_badge")}
          </span>
        )}
      </Link>
      <div className="p-3">
        <Link to={"/boutique/" + product.slug} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium hover:text-primary">
          {product.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-bold text-primary">{formatPrice(product.price)}</p>
          {!soldOut && (
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

function Contours() {
  const blob = "M-120,-20 C-110,-90 -30,-120 40,-100 C110,-80 140,-20 120,40 C100,100 30,130 -40,110 C-110,90 -130,30 -120,-20 Z"
  return (
    <svg aria-hidden="true" viewBox="-200 -200 400 400" className="pointer-events-none absolute -right-24 -top-28 h-[380px] w-[380px] text-white sm:-right-10 sm:h-[460px] sm:w-[460px]">
      {[0.3, 0.5, 0.7, 0.9, 1.1, 1.35].map((k) => (
        <path key={k} d={blob} transform={`scale(${k})`} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  const name = useShopName()
  const navigate = useNavigate()
  const formatPrice = useFormatPrice()
  const [search, setSearch] = useState("")

  const { data: about } = useQuery({
    queryKey: ["about"],
    queryFn: async () => (await aboutApi.get()).data.data,
    staleTime: 60_000,
  })
  const banner = about?.banner_home_url || ""
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await catalogApi.products()).data,
  })
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await catalogApi.categories()).data.data,
    staleTime: 60_000,
  })
  const courses = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => (await coursesApi.catalog()).data.data,
    staleTime: 60_000,
  })
  const ship = useQuery({
    queryKey: ["shipping"],
    queryFn: async () => (await shippingApi.get()).data.data,
    staleTime: 60_000,
  })

  const freeAt = ship.data?.free_shipping_threshold ?? 0
  const categories = (cats.data ?? []).filter((c) => c.products_count > 0)
  const courseRows = (courses.data ?? []).slice(0, 4)

  const trust = [
    { d: SHIELD, label: en ? "Secure payment" : "Paiement sécurisé" },
    {
      d: TRUCK,
      label: freeAt > 0
        ? en ? `Free delivery from ${formatPrice(freeAt)}` : `Livraison offerte dès ${formatPrice(freeAt)}`
        : en ? "Delivery or pickup" : "Livraison ou retrait",
    },
    { d: HEADSET, label: en ? "Help on WhatsApp" : "Aide sur WhatsApp" },
  ]

  const waGeneral = whatsappUrl(en ? "Hello, I have a question about your products." : "Bonjour, j'ai une question sur vos produits.")

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/boutique?q=${encodeURIComponent(q)}` : "/boutique")
  }

  return (
    <div className="space-y-8 sm:space-y-12">
      <section data-tour="hero" className="relative overflow-hidden rounded-card bg-primary-dark px-5 py-10 text-white shadow-card-lg sm:px-10 sm:py-16">
        {banner ? (
          <>
            <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary-dark/85 via-primary-dark/75 to-primary-dark/90 sm:bg-gradient-to-r sm:from-primary-dark/95 sm:via-primary-dark/80 sm:to-primary-dark/25" aria-hidden="true" />
          </>
        ) : (
          <Contours />
        )}
        <div className="relative max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-[1.05] [text-shadow:0_2px_12px_rgb(0_0_0/0.45)] sm:text-6xl">{t("home.title", { name })}</h1>
          <p className="mt-4 max-w-xl text-base text-primary-light [text-shadow:0_1px_8px_rgb(0_0_0/0.45)] sm:text-lg">{t("home.subtitle")}</p>

          <form onSubmit={submitSearch} role="search" className="relative mt-6 max-w-md">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Svg d={SEARCH} className="h-5 w-5" /></span>
            <input
              type="search" inputMode="search" enterKeyHint="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ux.search")} aria-label={t("ux.search")}
              className="min-h-[50px] w-full rounded-xl border border-transparent bg-white py-2.5 pl-11 pr-4 text-base text-ink shadow-card outline-none focus:ring-2 focus:ring-accent"
            />
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/boutique" className={buttonClass({ variant: "accent", size: "lg" })}>
              {t("home.browse")}
            </Link>

            {WHATSAPP_NUMBER && (
              <a
                href={waGeneral}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={en ? "Write on WhatsApp" : "Écrire sur WhatsApp"}
                title="WhatsApp" className="flex h-[52px] flex-none items-center justify-center gap-2 rounded-xl border border-white/40 px-3.5 text-white transition hover:bg-white/10 active:scale-95 sm:px-5"
              >
                <Svg d={CHAT} className="h-6 w-6" /><span className="hidden text-sm font-semibold sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </section>

      <ul data-tour="trust" className="grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface">
        {trust.map((item) => (
          <li key={item.label} className="flex flex-col items-center gap-1.5 px-2 py-3.5 text-center text-xs font-medium leading-snug text-ink sm:flex-row sm:justify-center sm:gap-3 sm:text-sm">
            <span className="text-primary"><Svg d={item.d} className="h-6 w-6" /></span>
            {item.label}
          </li>
        ))}
      </ul>

      {categories.length > 0 && (
        <section aria-label={en ? "Categories" : "Catégories"}>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/boutique?cat=${encodeURIComponent(c.slug)}`}
                className="flex min-h-[44px] flex-none items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium transition hover:border-primary hover:text-primary active:scale-95"
              >
                {c.name}
                <span className="text-xs text-muted">{c.products_count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section data-tour="new">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold sm:text-2xl">{t("home.new")}</h2>
          <Link to="/boutique" className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
            {en ? "See all" : "Voir tout"}
            <Svg d={ARROW} className="h-4 w-4" />
          </Link>
        </div>
        {isLoading && <HomeRowSkeleton />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.data.length === 0 && <EmptyState message={t("shop.empty")} />}
        {data && data.data.length > 0 && (
          <div className="stagger -mx-4 flex snap-x snap-mandatory [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:[mask-image:none] gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {data.data.slice(0, 8).map((product) => (
              <MiniCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {courseRows.length > 0 ? (
        <section aria-label={en ? "Our courses" : "Nos formations"}>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">{en ? "Our courses" : "Nos formations"}</h2>
            <Link to="/decouvrir/formations" className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
              {en ? "See all" : "Voir tout"}
              <Svg d={ARROW} className="h-4 w-4" />
            </Link>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {courseRows.map((x) => (
              <Link
                key={x.id}
                to={`/formations/${x.slug}`}
                className="w-[220px] flex-none snap-start overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:border-primary sm:w-auto"
              >
                {x.image_url ? (
                  <img src={x.image_url} alt="" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="aspect-[16/10] w-full bg-gradient-to-br from-primary/80 to-primary-dark" />
                )}
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{x.title}</h3>
                  {x.teacher && <p className="mt-1 truncate text-xs text-muted">{x.teacher}</p>}
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/formations/inscription"
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-primary/40 px-5 text-sm font-semibold text-primary transition hover:bg-primary/5 active:scale-95 sm:w-auto"
          >
            {en ? "Sign up for a course" : "S'inscrire à une formation"}
          </Link>
        </section>
      ) : (
        <Link to="/decouvrir/formations" className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-primary">
          <span className="min-w-0">
            <span className="block font-semibold">{en ? "Our courses" : "Nos formations"}</span>
            <span className="block text-sm text-muted">{en ? "Discover the courses and sign up" : "Découvrir les formations et s'inscrire"}</span>
          </span>
          <Svg d={ARROW} className="h-5 w-5 flex-none text-primary" />
        </Link>
      )}

      <Link to="/decouvrir" className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-primary">
        <span className="min-w-0">
          <span className="block font-semibold">{en ? "Our story" : "Notre histoire"}</span>
          <span className="block text-sm text-muted">{en ? "Who we are, the shop and our courses" : "Qui nous sommes, la boutique et nos formations"}</span>
        </span>
        <Svg d={ARROW} className="h-5 w-5 flex-none text-primary" />
      </Link>

      <RecentlyViewed />
    </div>
  )
}