import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi, type ProductPayload } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import type { Product } from "../../types"

const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [price, setPrice] = useState(String(product?.price ?? 0))
  const [stock, setStock] = useState(String(product?.stock ?? 0))
  const [published, setPublished] = useState(product?.is_published ?? false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (payload: ProductPayload) =>
      product ? adminApi.updateProduct(product.id, payload) : adminApi.createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      onDone()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const priceNumber = Number(price)
    const stockNumber = Number(stock)
    if (!Number.isInteger(priceNumber) || priceNumber < 0) {
      setError(t("admin.price_error"))
      return
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setError(t("admin.stock_error"))
      return
    }
    save.mutate({
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      price: priceNumber,
      stock: stockNumber,
      is_published: published,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold">{product ? t("admin.edit_title", { name: product.name }) : t("admin.new_product")}</h2>
      <label className="block text-sm font-medium">
        {t("admin.name")}
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("admin.description")}
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("admin.price_label")}
          <input type="number" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.stock")}
          <input type="number" min={0} step={1} required value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("admin.published_label")}
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {save.isPending ? t("admin.saving") : t("admin.save")}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-page">
          {t("admin.cancel")}
        </button>
      </div>
    </form>
  )
}

export default function AdminProductsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-products", page],
    queryFn: async () => (await adminApi.products(page)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  const toggle = useMutation({
    mutationFn: (p: Product) => adminApi.updateProduct(p.id, { is_published: !p.is_published }),
    onSuccess: refresh,
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (p: Product) => adminApi.deleteProduct(p.id),
    onSuccess: async () => {
      if (data && data.data.length === 1 && page > 1) setPage(page - 1)
      await refresh()
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  function handleDelete(p: Product) {
    if (window.confirm(t("admin.confirm_delete", { name: p.name }))) {
      setActionError(null)
      remove.mutate(p)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.products")} {data && <span className="text-muted">({data.meta.total})</span>}</h2>
        <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          {t("admin.add_product")}
        </button>
      </div>

      {editing !== null && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_products")} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.col_product")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_price")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.stock")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("admin.col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3">{p.stock ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.is_published ? "bg-success/10 text-success" : "bg-page text-muted"}`}>
                      {p.is_published ? t("admin.published") : t("admin.draft")}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setEditing(p)} className="font-semibold text-primary hover:underline">{t("admin.edit")}</button>
                    <button type="button" onClick={() => toggle.mutate(p)} disabled={toggle.isPending} className="font-semibold text-muted hover:text-ink">
                      {p.is_published ? t("admin.unpublish") : t("admin.publish")}
                    </button>
                    <button type="button" onClick={() => handleDelete(p)} disabled={remove.isPending} className="font-semibold text-danger hover:underline">{t("admin.delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}