import { useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import ProductCard from "../components/ProductCard"
import Button from "../components/Button"
import ShopFilterSheet, { type ShopFilters } from "../components/ShopFilterSheet"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import RecentlyViewed from "../components/RecentlyViewed"
import type { Product } from "../types"

const SORTS = [
  { value: "new", key: "ux.sort_new" },
  { value: "price_asc", key: "ux.sort_price_asc" },
  { value: "price_desc", key: "ux.sort_price_desc" },
]


const field =
  "min-h-[48px] rounded-lg border border-line bg-surface px-3.5 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

const chip = (active: boolean) =>
  `min-h-[40px] flex-none rounded-full border px-4 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary/50"
  }`

export default function ProductsPage() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const sort = params.get("sort") ?? "new"
  const onlyStock = params.get("stock") === "1"
  const onlyNew = params.get("new") === "1"
  const category = params.get("cat") ?? ""
  const minPrice = Number(params.get("min")) || 0
  const maxPrice = Number(params.get("max")) || 0
  const [input, setInput] = useState(q)
  const [sheet, setSheet] = useState(false)
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await catalogApi.categories()).data.data, staleTime: 60_000 })

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    p.delete("page")
    setParams(p, { replace: true })
  }

  useEffect(() => {
    if (input.trim() === q) return
    const id = setTimeout(() => update({ q: input.trim() }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  const { data, isLoading, isPlaceholderData, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["products-inf", { q, sort, category, minPrice, maxPrice, onlyStock, onlyNew }],
    queryFn: async ({ pageParam }) => (await catalogApi.products({ page: pageParam, search: q || undefined, sort, category: category || undefined, min_price: minPrice || undefined, max_price: maxPrice || undefined, in_stock: onlyStock ? 1 : undefined, new: onlyNew ? 1 : undefined })).data,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  })

  const all = useMemo(() => {
    const seen = new Set<number>()
    const out: Product[] = []
    for (const page of data?.pages ?? []) {
      for (const p of page.data) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          out.push(p)
        }
      }
    }
    return out
  }, [data])

  const shown = all
  const filtering = onlyStock || onlyNew || !!category || !!minPrice || !!maxPrice
  const total = data?.pages[0]?.meta.total ?? 0
  const activeCount = (onlyStock ? 1 : 0) + (onlyNew ? 1 : 0) + (category ? 1 : 0) + (minPrice || maxPrice ? 1 : 0)

  const clearFilters = () => update({ stock: "", new: "", cat: "", min: "", max: "" })

  // Pastilles des filtres actifs
  const fmt = (n: number) => n.toLocaleString(fr ? "fr-FR" : "en-US")
  const priceLabel =
    minPrice && maxPrice ? `${fmt(minPrice)} – ${fmt(maxPrice)} FCFA`
    : minPrice ? `≥ ${fmt(minPrice)} FCFA`
    : maxPrice ? `≤ ${fmt(maxPrice)} FCFA`
    : ""
  const catName = cats.data?.find((c) => c.slug === category)?.name ?? category
  const pills: { key: string; label: string; remove: () => void }[] = []
  if (q) pills.push({ key: "q", label: `« ${q} »`, remove: () => { setInput(""); update({ q: "" }) } })
  if (category) pills.push({ key: "cat", label: catName, remove: () => update({ cat: "" }) })
  if (onlyStock) pills.push({ key: "stock", label: fr ? "En stock" : "In stock", remove: () => update({ stock: "" }) })
  if (onlyNew) pills.push({ key: "new", label: t("ux.new_badge"), remove: () => update({ new: "" }) })
  if (priceLabel) pills.push({ key: "price", label: priceLabel, remove: () => update({ min: "", max: "" }) })

  // Charge la suite automatiquement quand on approche du bas de la liste
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || isPlaceholderData) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: "400px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage, shown.length])

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{t("shop.title")}</h1>

      <div className="mb-5 space-y-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text" inputMode="search" data-tour="search" value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ux.search")} aria-label={t("ux.search")} enterKeyHint="search"
            className={`${field} w-full pl-11 ${input ? "pr-11" : ""}`}
          />
          {input && (
            <button
              type="button" onClick={() => { setInput(""); update({ q: "" }) }}
              aria-label={t("ux.clear", { defaultValue: "Effacer" })}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>

        <div className="flex gap-2" data-tour="filters">
          <button
            type="button" onClick={() => setSheet(true)} aria-haspopup="dialog"
            className={`${field} flex shrink-0 items-center gap-2 font-semibold hover:border-primary/50`}
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
            </svg>
            {fr ? "Filtres" : "Filters"}
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 text-xs font-bold text-white">{activeCount}</span>}
          </button>
          <select
            value={sort} onChange={(e) => update({ sort: e.target.value === "new" ? "" : e.target.value })}
            aria-label={t("ux.sort")} className={`${field} min-w-0 flex-1`}
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.key)}</option>)}
          </select>
        </div>

        {cats.data && cats.data.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label={fr ? "Catégories" : "Categories"}>
            <button type="button" aria-pressed={category === ""} onClick={() => update({ cat: "" })} className={chip(category === "")}>
              {fr ? "Toutes" : "All"}
            </button>
            {cats.data.map((c) => (
              <button key={c.id} type="button" aria-pressed={category === c.slug} onClick={() => update({ cat: c.slug })} className={chip(category === c.slug)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {pills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label={fr ? "Filtres actifs" : "Active filters"}>
            {pills.map((p) => (
              <span key={p.key} className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-xs font-semibold text-primary">
                {p.label}
                <button
                  type="button" onClick={p.remove} aria-label={`${fr ? "Retirer" : "Remove"} ${p.label}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none hover:bg-primary/15"
                >
                  &times;
                </button>
              </span>
            ))}
            {pills.length > 1 && (
              <button type="button" onClick={() => { setInput(""); update({ q: "" }); clearFilters() }} className="px-1 text-xs font-semibold text-muted underline hover:text-danger">
                {fr ? "Tout effacer" : "Clear all"}
              </button>
            )}
          </div>
        )}

        {data && all.length > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            {filtering
              ? fr ? `${total} produit(s)` : `${total} product(s)`
              : t("shop.count", { count: total, defaultValue: "{{count}} produit(s)" })}
          </p>
        )}
      </div>

      {sheet && (
        <ShopFilterSheet
          fr={fr}
          categories={cats.data ?? []}
          initial={{ category, stock: onlyStock, fresh: onlyNew, min: minPrice ? String(minPrice) : "", max: maxPrice ? String(maxPrice) : "" } satisfies ShopFilters}
          onClose={() => setSheet(false)}
          onApply={(f) => {
            update({ cat: f.category, stock: f.stock ? "1" : "", new: f.fresh ? "1" : "", min: f.min, max: f.max })
            setSheet(false)
          }}
        />
      )}

      {isLoading && <ProductGridSkeleton />}
      {error && !data && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && shown.length === 0 && !hasNextPage && (
        <EmptyState
          message={q ? t("ux.no_results", { q }) : filtering ? (fr ? "Aucun produit ne correspond à ces filtres" : "No product matches these filters") : t("shop.empty")}
          actionLabel={filtering ? (fr ? "Retirer les filtres" : "Clear filters") : undefined}
          onAction={filtering ? clearFilters : undefined}
        />
      )}

      {shown.length > 0 && (
        <div className={`stagger grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${isPlaceholderData ? "opacity-60" : ""}`}>
          {shown.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div ref={sentinel} className="mt-6 flex justify-center">
          <Button variant="secondary" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {fr ? "Voir plus de produits" : "Show more products"}
          </Button>
        </div>
      )}
      {!hasNextPage && shown.length > 0 && (
        <p className="mt-6 text-center text-sm text-muted">{fr ? "Vous avez tout vu." : "You've seen everything."}</p>
      )}

      {!q && <div className="mt-10"><RecentlyViewed /></div>}
    </div>
  )
}
