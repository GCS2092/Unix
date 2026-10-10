import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import ProductImage from "./ProductImage"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { useRecentStore } from "../stores/recentStore"

export default function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const { i18n } = useTranslation()
  const formatPrice = useFormatPrice()
  const all = useRecentStore((s) => s.items)
  const clear = useRecentStore((s) => s.clear)
  const fr = i18n.language.startsWith("fr")
  const items = all.filter((p) => p.slug !== excludeSlug)

  if (items.length === 0) return null

  return (
    <section aria-label={fr ? "Vus récemment" : "Recently viewed"}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold sm:text-xl">{fr ? "Vus récemment" : "Recently viewed"}</h2>
        <button type="button" onClick={clear} className="min-h-[36px] text-sm text-muted underline hover:text-ink">
          {fr ? "Effacer" : "Clear"}
        </button>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/boutique/${p.slug}`}
            className="w-[132px] flex-none snap-start overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-card-lg sm:w-[150px]"
          >
            <ProductImage src={p.image} alt={p.name} ratio="aspect-square" imgClassName={p.in_stock === false ? "grayscale" : ""} />
            <div className="p-2.5">
              <p className="line-clamp-2 min-h-[2.25rem] text-xs font-medium sm:text-sm">{p.name}</p>
              <p className="mt-1 text-sm font-bold text-primary">{formatPrice(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}