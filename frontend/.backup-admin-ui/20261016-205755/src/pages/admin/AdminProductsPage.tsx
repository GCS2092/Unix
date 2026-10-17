import { useTranslation } from "react-i18next"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi, type ProductPayload } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import CategoriesPanel from "./CategoriesPanel"
import Button from "../../components/Button"
import type { Product } from "../../types"

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [nameEn, setNameEn] = useState(product?.name_en ?? "")
  const [descriptionEn, setDescriptionEn] = useState(product?.description_en ?? "")
  const [price, setPrice] = useState(String(product?.price ?? 0))
  const [stock, setStock] = useState(String(product?.stock ?? 0))
  const [published, setPublished] = useState(product?.is_published ?? false)
  const [categoryId, setCategoryId] = useState(product?.category_id ? String(product.category_id) : "")
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await adminApi.categories()).data.data, staleTime: 30_000 })
  const [link, setLink] = useState(product?.image_link ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview) }, [filePreview])
  const preview = filePreview ?? (removeImage ? null : link.trim() || product?.image_url || null)
  const [error, setError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<{ id: number; url: string }[]>(product?.gallery ?? [])
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

  async function addGallery(files: File[]) {
    if (!product || files.length === 0) return
    setGalleryBusy(true)
    setGalleryError(null)
    try {
      let last = gallery
      for (const f of files) {
        const res = await adminApi.addGalleryImage(product.slug, f)
        last = res.data.data.gallery ?? last
      }
      setGallery(last)
      await queryClient.invalidateQueries({ queryKey: ["products"] })
    } catch (e) {
      setGalleryError(getErrorMessage(e))
    } finally {
      setGalleryBusy(false)
    }
  }

  async function removeGallery(id: number) {
    if (!product) return
    setGalleryBusy(true)
    setGalleryError(null)
    try {
      const res = await adminApi.removeGalleryImage(product.slug, id)
      setGallery(res.data.data.gallery ?? [])
      await queryClient.invalidateQueries({ queryKey: ["products"] })
    } catch (e) {
      setGalleryError(getErrorMessage(e))
    } finally {
      setGalleryBusy(false)
    }
  }

  async function persist(payload: ProductPayload) {
    const res = product ? await adminApi.updateProduct(product.slug, payload) : await adminApi.createProduct(payload)
    const slug = res.data.data.slug
    if (file) await adminApi.uploadImage(slug, file)
    else if (removeImage && product) await adminApi.removeImage(slug)
  }

  const save = useMutation({
    mutationFn: (payload: ProductPayload) => persist(payload),
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
      name_en: nameEn.trim() === "" ? null : nameEn.trim(),
      description_en: descriptionEn.trim() === "" ? null : descriptionEn,
      price: priceNumber,
      stock: stockNumber,
      is_published: published,
      category_id: categoryId ? Number(categoryId) : null,
      image_link: link.trim() === "" ? null : link.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} data-tour="pr-form" className="mb-6 space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-lg font-semibold">
        {product ? t("admin.edit_title", { name: product.name }) : t("admin.new_product")}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("admin.name")}
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.name_en")}
          <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.description")}
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.description_en")}
          <textarea rows={3} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-muted">{t("admin.english_hint")}</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("admin.price_label")}
          <input type="number" min={0} step={1} required inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("admin.stock")}
          <input type="number" min={0} step={1} required inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} disabled={Boolean(product)} title={product ? "Le stock se modifie depuis la page Stock" : undefined} />
        </label>
      </div>

      <div className="space-y-2 text-sm font-medium">
        <span>{t("admin.image")}</span>
        {preview && <img src={preview} alt="" className="h-32 w-32 rounded-lg border border-line object-cover" />}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm font-normal"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setRemoveImage(false)
            if (e.target.files?.[0]) setLink("")
          }}
        />
        <input
          type="url"
          placeholder={t("admin.image_link")}
          value={link}
          onChange={(e) => { setLink(e.target.value); setFile(null); setRemoveImage(false) }}
          className={inputClass}
        />
        <span className="block text-xs font-normal text-muted">{t("admin.image_hint")}</span>
        {product && (product.image_url || file || link) && (
          <button
            type="button"
            onClick={() => { setFile(null); setLink(""); setRemoveImage(true) }}
            className="min-h-[40px] text-sm font-semibold text-danger hover:underline"
          >
            {t("admin.image_remove")}
          </button>
        )}
      </div>

      {product ? (
        <div className="space-y-2 text-sm font-medium">
          <span>{t("admin.gallery", { defaultValue: "Images supplémentaires" })}</span>
          {gallery.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {gallery.map((g) => (
                <li key={g.id} className="relative">
                  <img src={g.url} alt="" className="h-24 w-24 rounded-lg border border-line object-cover" />
                  <button
                    type="button"
                    onClick={() => void removeGallery(g.id)}
                    disabled={galleryBusy}
                    aria-label={t("admin.image_remove")}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-sm font-bold text-white shadow-sm disabled:opacity-60"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={galleryBusy}
            className="block w-full text-sm font-normal"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ""
              void addGallery(files)
            }}
          />
          <span className="block text-xs font-normal text-muted">
            {galleryBusy
              ? t("admin.gallery_sending", { defaultValue: "Envoi en cours…" })
              : t("admin.gallery_hint", { defaultValue: "JPG, PNG ou WebP, 2 Mo maximum par image, 8 images maximum." })}
          </span>
          {galleryError && <span className="block text-sm text-danger">{galleryError}</span>}
        </div>
      ) : (
        <p className="text-xs text-muted">
          {t("admin.gallery_new", { defaultValue: "Enregistrez le produit, puis rouvrez-le pour ajouter d'autres images." })}
        </p>
      )}

      <label className="block text-sm font-medium sm:max-w-xs">
        {t("admin.category", { defaultValue: "Catégorie" })}
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">{t("admin.no_category", { defaultValue: "Sans catégorie" })}</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="h-5 w-5" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("admin.published_label")}
      </label>

      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={save.isPending} className="w-full sm:w-auto">
          {save.isPending ? t("admin.saving") : t("admin.save")}
        </Button>
        <Button variant="secondary" onClick={onDone} className="w-full sm:w-auto">
          {t("admin.cancel")}
        </Button>
      </div>
    </form>
  )
}

export default function AdminProductsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [qInput, setQInput] = useState("")
  const [filters, setFilters] = useState({ q: "", stock: "", published: "", category: "" })
  const [showCats, setShowCats] = useState(false)
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
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-products", page, filters],
    queryFn: async () => (await adminApi.products(page, filters)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  const toggle = useMutation({
    mutationFn: (p: Product) => adminApi.updateProduct(p.slug, { is_published: !p.is_published }),
    onSuccess: refresh,
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (p: Product) => adminApi.deleteProduct(p.slug),
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

  const statusBadge = (p: Product) => (
    <span
      className={`inline-block shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
        p.is_published ? "bg-success/10 text-success" : "bg-page text-muted"
      }`}
    >
      {p.is_published ? t("admin.published") : t("admin.draft")}
    </span>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">
          {t("admin.products")} {data && <span className="text-muted">({data.meta.total})</span>}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowCats((v) => !v)}>{t("admin.categories", { defaultValue: "Catégories" })}</Button>
          <Button data-tour="pr-add" onClick={() => setEditing("new")}>{t("admin.add_product")}</Button>
        </div>
      </div>

      {showCats && <CategoriesPanel />}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t("admin.search_products", { defaultValue: "Rechercher un produit" })} className={inputClass} />
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
      </div>

      {editing !== null && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {actionError && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_products")} />}

      {data && data.data.length > 0 && (
        <>
          {/* Mobile : cartes */}
          <ul data-tour="pr-list" className="space-y-3 md:hidden">
            {data.data.map((p) => (
              <li key={p.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold">{p.name}</p>
                  {statusBadge(p)}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatPrice(p.price)} · {t("admin.stock")} : {p.stock ?? "—"}
                </p>
                <div data-tour="pr-edit" className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-primary hover:bg-page"
                  >
                    {t("admin.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle.mutate(p)}
                    disabled={toggle.isPending}
                    className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-muted hover:bg-page disabled:opacity-60"
                  >
                    {p.is_published ? t("admin.unpublish") : t("admin.publish")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={remove.isPending}
                    className="min-h-[40px] rounded-lg border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Ordinateur : tableau */}
          <div data-tour="pr-list" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
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
                    <td className="px-4 py-3 font-medium">{p.name}{p.category && <span className="block text-xs font-normal text-muted">{p.category.name}</span>}</td>
                    <td className="px-4 py-3">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">{p.stock ?? "—"}</td>
                    <td className="px-4 py-3">{statusBadge(p)}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" data-tour="pr-edit" onClick={() => setEditing(p)} className="font-semibold text-primary hover:underline">
                        {t("admin.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle.mutate(p)}
                        disabled={toggle.isPending}
                        className="font-semibold text-muted hover:text-ink"
                      >
                        {p.is_published ? t("admin.unpublish") : t("admin.publish")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        disabled={remove.isPending}
                        className="font-semibold text-danger hover:underline"
                      >
                        {t("admin.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}