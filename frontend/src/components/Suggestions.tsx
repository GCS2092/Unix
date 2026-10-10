import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import { useCartStore } from "../stores/cartStore"
import { useDrawerStore } from "../stores/drawerStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { useFormatPrice } from "../hooks/useFormatPrice"
import ProductImage from "./ProductImage"
import type { Product } from "../types"

type Variant = "list" | "grid"

const PLUS = "M12 5v14M5 12h14"
const CHECK = "M5 12l5 5 9-10"

function QuickAdd({ product, feedback }: { product: Product; feedback: boolean }) {
  const { t } = useTranslation()
  const add = useCartStore((s) => s.add)
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")

  useEffect(() => {
    if (status !== "done") return
    const id = setTimeout(() => setStatus("idle"), 1500)
    return () => clearTimeout(id)
  }, [status])

  async function onClick() {
    if (status === "loading") return
    setStatus("loading")
    try {
      await add("product", product.id, 1)
      setStatus("done")
      if ("vibrate" in navigator) navigator.vibrate(12)
      if (feedback) {
        if (/^\/(panier|commande)/.test(window.location.pathname)) toast.success(t("product.added_toast"))
        else useDrawerStore.getState().show()
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
      setStatus("idle")
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={status === "loading"}
      aria-label={`${t("product.add")} : ${product.name}`}
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-white transition active:scale-90 disabled:opacity-60 ${
        status === "done" ? "bg-primary-dark" : "bg-primary hover:bg-primary-dark"
      }`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={status === "done" ? CHECK : PLUS} />
      </svg>
    </button>
  )
}

export default function Suggestions({
  excludeIds = [],
  limit = 4,
  variant = "grid",
}: {
  excludeIds?: number[]
  limit?: number
  variant?: Variant
}) {
  const { i18n } = useTranslation()
  const formatPrice = useFormatPrice()
  const fr = i18n.language.startsWith("fr")
  const title = fr ? "Vous aimerez aussi" : "You may also like"

  const { data } = useQuery({
    queryKey: ["suggestions"],
    queryFn: async () => (await catalogApi.products({ sort: "new" })).data.data,
    staleTime: 60_000,
  })

  const items = (data ?? [])
    .filter((p) => p.in_stock !== false && !excludeIds.includes(p.id))
    .slice(0, limit)

  if (items.length === 0) return null

  const img = (p: Product) => p.images?.[0] ?? p.image_url ?? null

  if (variant === "list") {
    return (
      <section aria-label={title}>
        <h2 className="mb-2 text-base font-bold">{title}</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2.5">
              <Link to={`/boutique/${p.slug}`} className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line">
                <ProductImage src={img(p)} alt={p.name} compact />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/boutique/${p.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">{p.name}</Link>
                <p className="text-sm font-bold text-primary">{formatPrice(p.price)}</p>
              </div>
              <QuickAdd product={p} feedback={false} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-bold sm:text-xl">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {items.map((p) => (
          <article key={p.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <Link to={`/boutique/${p.slug}`}>
              <ProductImage src={img(p)} alt={p.name} ratio="aspect-square" />
            </Link>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <Link to={`/boutique/${p.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium hover:text-primary">{p.name}</Link>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <p className="font-bold text-primary">{formatPrice(p.price)}</p>
                <QuickAdd product={p} feedback />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}