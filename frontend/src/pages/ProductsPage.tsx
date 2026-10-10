import { useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import ProductCard from "../components/ProductCard"
import Button from "../components/Button"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import RecentlyViewed from "../components/RecentlyViewed"
import type { Product } from "../types"

const SORTS = [
  { value: "new", key: "ux.sort_new" },
  { value: "price_asc", key: "ux.sort_price_asc" },
  { value: "price_desc", key: "ux.sort_price_desc" },
]

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const isRecent = (createdAt: string) => {
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) && Date.now() - time < FOURTEEN_DAYS
}

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
  const [input, setInput] = useState(q)

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
    queryKey: ["products-inf", { q, sort }],
    queryFn: async ({ pageParam }) => (await catalogApi.products({ page: pageParam, search: q || undefined, sort })).data,
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

  const shown = useMemo(
    () => all.filter((p) => (!onlyStock || p.in_stock !== false) && (!onlyNew || isRecent(p.created_at))),
    [all, onlyStock, onlyNew],
  )
  const filtering = onlyStock || onlyNew
  const total = data?.pages[0]?.meta.total ?? 0

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
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            inputMode="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ux.search")}
            aria-label={t("ux.search")}
            enterKeyHint="search"
            className={`${field} w-full pl-11 ${input ? "pr-11" : ""}`}
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("")
                update({ q: "" })
              }}
              aria-label={t("ux.clear", { defaultValue: "Effacer" })}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label={t("ux.sort")}>
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={sort === s.value}
              onClick={() => update({ sort: s.value === "new" ? "" : s.value })}
              className={chip(sort === s.value)}
            >
              {t(s.key)}
            </button>
          ))}
          <span className="mx-1 w-px flex-none bg-line" aria-hidden="true" />
          <button type="button" aria-pressed={onlyStock} onClick={() => update({ stock: onlyStock ? "" : "1" })} className={chip(onlyStock)}>
            {fr ? "En stock" : "In stock"}
          </button>
          <button type="button" aria-pressed={onlyNew} onClick={() => update({ new: onlyNew ? "" : "1" })} className={chip(onlyNew)}>
            {t("ux.new_badge")}
          </button>
        </div>

        {data && all.length > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            {filtering
              ? fr ? `${shown.length} produit(s) affiché(s)` : `${shown.length} product(s) shown`
              : t("shop.count", { count: total, defaultValue: "{{count}} produit(s)" })}
          </p>
        )}
      </div>

      {isLoading && <ProductGridSkeleton />}
      {error && !data && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && shown.length === 0 && !hasNextPage && (
        <EmptyState
          message={q ? t("ux.no_results", { q }) : filtering ? (fr ? "Aucun produit ne correspond à ces filtres" : "No product matches these filters") : t("shop.empty")}
          actionLabel={filtering ? (fr ? "Retirer les filtres" : "Clear filters") : undefined}
          onAction={filtering ? () => update({ stock: "", new: "" }) : undefined}
        />
      )}

      {shown.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${isPlaceholderData ? "opacity-60" : ""}`}>
          {shown.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Les filtres s'appliquent aux produits déjà chargés : on continue donc à charger tant qu'il en reste */}
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