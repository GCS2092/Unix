import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import ProductCard from "../components/ProductCard"
import Pagination from "../components/Pagination"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"

const field =
  "min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ux.search")}
            aria-label={t("ux.search")}
            enterKeyHint="search"
            className={`${field} w-full`}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "new" ? "" : e.target.value, page: "" })}
          aria-label={t("ux.sort")}
          className={field}
        >
          <option value="new">{t("ux.sort_new")}</option>
          <option value="price_asc">{t("ux.sort_price_asc")}</option>
          <option value="price_desc">{t("ux.sort_price_desc")}</option>
        </select>
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