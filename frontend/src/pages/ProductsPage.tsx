import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import ProductCard from "../components/ProductCard"
import Pagination from "../components/Pagination"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"

const SORTS = [
  { value: "new", key: "ux.sort_new" },
  { value: "price_asc", key: "ux.sort_price_asc" },
  { value: "price_desc", key: "ux.sort_price_desc" },
]

const field =
  "min-h-[48px] rounded-lg border border-line bg-surface px-3.5 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

export default function ProductsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get("page")) || 1)
  const q = params.get("q") ?? ""
  const sort = params.get("sort") ?? "new"
  const [input, setInput] = useState(q)

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  useEffect(() => {
    if (input.trim() === q) return
    const id = setTimeout(() => update({ q: input.trim(), page: "" }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ["products", { page, q, sort }],
    queryFn: async () => (await catalogApi.products({ page, search: q || undefined, sort })).data,
    placeholderData: keepPreviousData,
  })

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
                update({ q: "", page: "" })
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
          {SORTS.map((s) => {
            const active = sort === s.value
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ sort: s.value === "new" ? "" : s.value, page: "" })}
                className={`min-h-[40px] flex-none rounded-full border px-4 text-sm font-medium transition ${
                  active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary/50"
                }`}
              >
                {t(s.key)}
              </button>
            )
          })}
        </div>

        {data && data.data.length > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            {t("shop.count", { count: data.meta.total, defaultValue: "{{count}} produit(s)" })}
          </p>
        )}
      </div>

      {isLoading && <ProductGridSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState message={q ? t("ux.no_results", { q }) : t("shop.empty")} />
      )}
      {data && data.data.length > 0 && (
        <>
          <div className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${isPlaceholderData ? "opacity-60" : ""}`}>
            {data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            meta={data.meta}
            onChange={(p) => {
              update({ page: p > 1 ? String(p) : "" })
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
          />
        </>
      )}
    </div>
  )
}