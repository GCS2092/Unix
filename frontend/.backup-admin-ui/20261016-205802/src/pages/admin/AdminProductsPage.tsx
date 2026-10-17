import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { confirmAction } from "../../stores/confirmStore"
import { EmptyState, ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import CategoriesPanel from "./CategoriesPanel"
import ProductFormDrawer from "./ProductFormDrawer"
import { IconButton, PageHeader, Pill, StatCard, Svg, Switch, Thumb } from "../../components/admin/ui"
import { inputClass } from "../../components/admin/adminStyles"
import type { PaginationMeta, Product } from "../../types"

const I_PLUS = "M12 5v14M5 12h14"
const I_PENCIL = "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
const I_LAYERS = "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"
const I_TRASH = "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"
const I_BOX = "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"
const I_ALERT = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
const I_X = "M12 21a9 9 0 100-18 9 9 0 000 18zM15 9l-6 6M9 9l6 6"
const I_SEARCH = "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"

type ListMeta = PaginationMeta & { low_stock_count?: number; out_of_stock_count?: number; low_stock_threshold?: number }

export default function AdminProductsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const initialQ = (params.get("q") ?? "").trim()
  const [page, setPage] = useState(1)
  const [qInput, setQInput] = useState(initialQ)
  const [filters, setFilters] = useState({ q: initialQ, stock: "", published: "", category: "" })
  const [showCats, setShowCats] = useState(false)
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const catsQuery = useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await adminApi.categories()).data.data, staleTime: 30_000 })

  useEffect(() => {
    if (qInput.trim() === filters.q) return
    const id = setTimeout(() => { setFilters((f) => ({ ...f, q: qInput.trim() })); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [qInput, filters.q])

  function setFilter(key: "stock" | "published" | "category", value: string) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  function resetFilters() {
    setQInput("")
    setFilters({ q: "", stock: "", published: "", category: "" })
    setPage(1)
  }

  const hasFilter = Boolean(filters.q || filters.stock || filters.published || filters.category)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-products", page, filters],
    queryFn: async () => (await adminApi.products(page, filters)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const meta = data?.meta as unknown as ListMeta | undefined
  const threshold = meta?.low_stock_threshold ?? 5

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    await queryClient.invalidateQueries({ queryKey: ["admin-stock"] })
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  const toggle = useMutation({
    mutationFn: (p: Product) => adminApi.updateProduct(p.slug, { is_published: !p.is_published }),
    onSuccess: async (_r, p) => {
      toast.success(p.is_published
        ? t("admin.toast_hidden", { defaultValue: "« {{name}} » est masqué du site.", name: p.name })
        : t("admin.toast_shown", { defaultValue: "« {{name}} » est visible sur le site.", name: p.name }))
      await refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (p: Product) => adminApi.deleteProduct(p.slug),
    onSuccess: async (_r, p) => {
      if (data && data.data.length === 1 && page > 1) setPage(page - 1)
      toast.success(t("admin.toast_deleted", { defaultValue: "« {{name}} » supprimé.", name: p.name }))
      await refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  async function handleDelete(p: Product) {
    const { ok } = await confirmAction({
      title: t("admin.confirm_delete", { name: p.name }),
      message: "Un produit déjà commandé ne peut pas être supprimé : masque-le plutôt.",
      confirmLabel: t("admin.delete"),
      danger: true,
    })
    if (ok) remove.mutate(p)
  }

  const stockPill = (p: Product) => {
    if (p.stock === undefined || p.stock === null) return <span className="text-muted">—</span>
    if (p.stock <= 0) return <Pill tone="danger" dot>Épuisé</Pill>
    if (p.stock <= threshold) return <Pill tone="warn" dot>{p.stock} · bas</Pill>
    return <Pill tone="success" dot>{p.stock}</Pill>
  }

  const stockLink = (p: Product) => `/admin/boutique/stock?q=${encodeURIComponent(p.name)}`
  const togglingId = toggle.isPending ? toggle.variables?.id : undefined

  const rowActions = (p: Product) => (
    <div className="flex items-center gap-1.5">
      <IconButton label={t("admin.edit")} dataTour="pr-edit" onClick={() => setEditing(p)}><Svg d={I_PENCIL} className="h-4 w-4" /></IconButton>
      <IconButton label={t("admin.adjust_stock", { defaultValue: "Ajuster le stock" })} to={stockLink(p)}><Svg d={I_LAYERS} className="h-4 w-4" /></IconButton>
      <IconButton label={t("admin.delete")} danger disabled={remove.isPending} onClick={() => void handleDelete(p)}><Svg d={I_TRASH} className="h-4 w-4" /></IconButton>
    </div>
  )

  const rows = data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t("admin.products")}
        count={meta?.total}
        subtitle={t("admin.products_subtitle", { defaultValue: "Gère ton catalogue : prix, visibilité, images et catégories." })}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCats((v) => !v)} aria-expanded={showCats}>
              {t("admin.categories", { defaultValue: "Catégories" })}
            </Button>
            <Button data-tour="pr-add" onClick={() => setEditing("new")}>
              <Svg d={I_PLUS} className="h-4 w-4" />
              {t("admin.add_product")}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("admin.products")}
          value={meta?.total ?? "—"}
          hint={hasFilter ? "avec les filtres actuels" : "au catalogue"}
          icon={I_BOX}
          tone="info"
          active={!hasFilter}
          onClick={resetFilters}
        />
        <StatCard
          label={t("admin.stock_low", { defaultValue: "Stock bas" })}
          value={meta?.low_stock_count ?? "—"}
          hint={`${threshold} unités ou moins`}
          icon={I_ALERT}
          tone="warn"
          active={filters.stock === "low"}
          onClick={() => setFilter("stock", filters.stock === "low" ? "" : "low")}
        />
        <StatCard
          label={t("admin.stock_out", { defaultValue: "Épuisés" })}
          value={meta?.out_of_stock_count ?? "—"}
          hint="indisponibles à l'achat"
          icon={I_X}
          tone="danger"
          active={filters.stock === "out"}
          onClick={() => setFilter("stock", filters.stock === "out" ? "" : "out")}
        />
      </div>

      {showCats && <div className="mb-5"><CategoriesPanel /></div>}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"><Svg d={I_SEARCH} className="h-4 w-4" /></span>
          <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t("admin.search_products", { defaultValue: "Rechercher un produit" })} className={`${inputClass} pl-9`} />
        </div>
        <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className={inputClass} aria-label={t("admin.category", { defaultValue: "Catégorie" })}>
          <option value="">{t("admin.all_categories", { defaultValue: "Toutes les catégories" })}</option>
          <option value="none">{t("admin.no_category", { defaultValue: "Sans catégorie" })}</option>
          {(catsQuery.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.products_count})</option>)}
        </select>
        <select value={filters.stock} onChange={(e) => setFilter("stock", e.target.value)} className={inputClass} aria-label={t("admin.stock")}>
          <option value="">{t("admin.all_stock", { defaultValue: "Tout le stock" })}</option>
          <option value="low">{t("admin.stock_low", { defaultValue: "Stock bas" })}</option>
          <option value="out">{t("admin.stock_out", { defaultValue: "Épuisés" })}</option>
        </select>
        <select value={filters.published} onChange={(e) => setFilter("published", e.target.value)} className={inputClass} aria-label={t("admin.col_status")}>
          <option value="">{t("admin.all_status", { defaultValue: "Tous les statuts" })}</option>
          <option value="1">{t("admin.published")}</option>
          <option value="0">{t("admin.draft")}</option>
        </select>
        {hasFilter && (
          <button type="button" onClick={resetFilters} className="min-h-[44px] whitespace-nowrap px-2 text-sm font-semibold text-primary hover:underline">
            Réinitialiser
          </button>
        )}
      </div>

      {isLoading && <ListSkeleton rows={5} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && rows.length === 0 && (
        hasFilter
          ? <EmptyState message="Aucun produit ne correspond à ces filtres." actionLabel="Réinitialiser les filtres" onAction={resetFilters} />
          : <EmptyState message={t("admin.no_products")} description="Ajoute ton premier produit pour remplir la boutique." actionLabel={t("admin.add_product")} onAction={() => setEditing("new")} />
      )}

      {rows.length > 0 && (
        <div className={`transition-opacity ${data && !isLoading && toggle.isPending ? "opacity-90" : ""}`}>
          {/* Mobile : cartes */}
          <ul data-tour="pr-list" className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="rounded-card border border-line bg-surface p-3.5 shadow-card">
                <div className="flex items-start gap-3">
                  <Thumb src={p.image_url} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setEditing(p)} className="block max-w-full truncate text-left font-semibold">{p.name}</button>
                    <p className="truncate text-xs text-muted">{p.category?.name ?? t("admin.no_category", { defaultValue: "Sans catégorie" })}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primary">{formatPrice(p.price)}</span>
                      {stockPill(p)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Switch checked={p.is_published ?? false} disabled={togglingId === p.id} onChange={() => toggle.mutate(p)} label={p.is_published ? t("admin.unpublish") : t("admin.publish")} />
                    <span className={p.is_published ? "text-emerald-700" : "text-muted"}>{p.is_published ? t("admin.published") : t("admin.draft")}</span>
                  </label>
                  {rowActions(p)}
                </div>
              </li>
            ))}
          </ul>

          {/* Ordinateur : tableau */}
          <div data-tour="pr-list" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.col_product")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.col_price")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.stock")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.col_status")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="transition hover:bg-page/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={p.image_url} className="h-12 w-12" />
                        <div className="min-w-0">
                          <button type="button" onClick={() => setEditing(p)} className="block max-w-[26ch] truncate text-left font-semibold hover:text-primary">{p.name}</button>
                          <p className="truncate text-xs text-muted">{p.category?.name ?? t("admin.no_category", { defaultValue: "Sans catégorie" })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">{stockPill(p)}</td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2.5">
                        <Switch checked={p.is_published ?? false} disabled={togglingId === p.id} onChange={() => toggle.mutate(p)} label={p.is_published ? t("admin.unpublish") : t("admin.publish")} />
                        <span className={`text-xs font-semibold ${p.is_published ? "text-emerald-700" : "text-muted"}`}>{p.is_published ? t("admin.published") : t("admin.draft")}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3"><div className="flex justify-end">{rowActions(p)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && <Pagination meta={data.meta} onChange={setPage} />}

      {editing !== null && (
        <ProductFormDrawer
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}