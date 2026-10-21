import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi, type ProductPayload } from "../../api/admin"
import { apiClient } from "../../api/client"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import RichEditor from "../../components/admin/RichEditor"
import { Drawer, Section, Svg, Switch } from "../../components/admin/ui"
import { inputClass, labelClass } from "../../components/admin/adminStyles"
import type { Product } from "../../types"

const UPLOAD = "M12 16V4M7 9l5-5 5 5M4 20h16"
const miniBtn =
  "grid h-7 w-7 flex-none place-items-center rounded-md border border-line bg-surface text-xs transition hover:bg-black/5 active:scale-95 disabled:opacity-30"

const pickerClass =
  "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/30"

export default function ProductFormDrawer({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [lang, setLang] = useState<"fr" | "en">("fr")
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [nameEn, setNameEn] = useState(product?.name_en ?? "")
  const [descriptionEn, setDescriptionEn] = useState(product?.description_en ?? "")
  const [price, setPrice] = useState(String(product?.price ?? 0))
  const [stock, setStock] = useState(String(product?.stock ?? 0))
  const [published, setPublished] = useState(product?.is_published ?? false)
  const [categoryId, setCategoryId] = useState(product?.category_id ? String(product.category_id) : "")
  const pr = (product ?? {}) as unknown as Record<string, string | null | undefined>
  const [specs, setSpecs] = useState(pr.specs ?? "")
  const [specsEn, setSpecsEn] = useState(pr.specs_en ?? "")
  const [delivery, setDelivery] = useState(pr.delivery_info ?? "")
  const [deliveryEn, setDeliveryEn] = useState(pr.delivery_info_en ?? "")
  const [coverOverride, setCoverOverride] = useState<string | null | undefined>(undefined)
  const cats = useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await adminApi.categories()).data.data, staleTime: 30_000 })
  const [link, setLink] = useState(product?.image_link ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview) }, [filePreview])
  const preview = filePreview ?? (removeImage ? null : link.trim() || (coverOverride !== undefined ? coverOverride : product?.image_url) || null)
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
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
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
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    } catch (e) {
      setGalleryError(getErrorMessage(e))
    } finally {
      setGalleryBusy(false)
    }
  }

  async function moveGallery(i: number, dir: -1 | 1) {
    const j = i + dir
    if (!product || j < 0 || j >= gallery.length) return
    const before = gallery
    const next = gallery.slice()
    const a = next[i]
    next[i] = next[j]
    next[j] = a
    setGallery(next)
    setGalleryBusy(true)
    setGalleryError(null)
    try {
      const res = await apiClient.post<{ data: Product }>(`/admin/products/${encodeURIComponent(product.slug)}/images/reorder`, { ids: next.map((g) => g.id) })
      setGallery(res.data.data.gallery ?? next)
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    } catch (e) {
      setGallery(before)
      setGalleryError(getErrorMessage(e))
    } finally {
      setGalleryBusy(false)
    }
  }

  async function makeCover(id: number) {
    if (!product) return
    setGalleryBusy(true)
    setGalleryError(null)
    try {
      const res = await apiClient.post<{ data: Product }>(`/admin/products/${encodeURIComponent(product.slug)}/images/${id}/cover`)
      const p = res.data.data
      setGallery(p.gallery ?? [])
      setCoverOverride(p.image_url ?? null)
      // Le champ lien doit suivre la nouvelle image principale, sinon l'enregistrement l'effacerait
      setLink(p.image_link ?? "")
      setFile(null)
      setRemoveImage(false)
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
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
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(t("admin.product_saved", { defaultValue: "Produit enregistré." }))
      onClose()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const priceNumber = Number(price)
    const stockNumber = Number(stock)
    if (!name.trim()) {
      setLang("fr")
      setError(t("admin.name_required", { defaultValue: "Le nom du produit est obligatoire." }))
      return
    }
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
      ...{
        specs: specs.trim() === "" ? null : specs,
        specs_en: specsEn.trim() === "" ? null : specsEn,
        delivery_info: delivery.trim() === "" ? null : delivery,
        delivery_info_en: deliveryEn.trim() === "" ? null : deliveryEn,
      },
    })
  }

  const priceNumber = Number(price)
  const pricePreview = price.trim() !== "" && Number.isInteger(priceNumber) && priceNumber >= 0 ? formatPrice(priceNumber) : null

  return (
    <Drawer
      open
      onClose={onClose}
      title={product ? t("admin.edit_title", { name: product.name }) : t("admin.new_product")}
      subtitle={product ? product.slug : t("admin.new_product_hint", { defaultValue: "Renseigne l'essentiel, tu pourras compléter ensuite." })}
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>{t("admin.cancel")}</Button>
            <Button type="submit" form="product-form" loading={save.isPending} className="sm:min-w-[170px]">
              {save.isPending ? t("admin.saving") : t("admin.save")}
            </Button>
          </div>
        </div>
      }
    >
      <form id="product-form" data-tour="pr-form" onSubmit={handleSubmit} className="space-y-4">
        <Section title={t("admin.section_info", { defaultValue: "Informations" })}>
          <div role="tablist" className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-semibold">
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`min-h-[32px] rounded-md px-4 transition ${lang === l ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {l === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>

          {lang === "fr" ? (
            <>
              <label className={labelClass}>
                {t("admin.name")}
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <RichEditor label={t("admin.description")} rows={8} value={description} onChange={setDescription} />
            </>
          ) : (
            <>
              <label className={labelClass}>
                {t("admin.name_en")}
                <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <RichEditor label={t("admin.description_en")} rows={8} value={descriptionEn} onChange={setDescriptionEn} hint={t("admin.english_hint")} />
            </>
          )}
        </Section>

        <Section title={lang === "fr" ? "Caractéristiques et livraison" : "Specifications and delivery"}>
          {lang === "fr" ? (
            <>
              <label className={labelClass}>
                Caractéristiques
                <textarea rows={5} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={"Matière : cuir\nCouleur : noir\nDimensions : 30 x 20 cm"} className={`${inputClass} mt-1`} />
                <span className="mt-1 block text-xs font-normal text-muted">Une ligne par caractéristique, sous la forme « Nom : valeur ». Affichées en tableau sur le site.</span>
              </label>
              <RichEditor label="Livraison et retours" rows={5} value={delivery} onChange={setDelivery} hint="Affiché sous la description. Laisser vide pour ne rien afficher." />
            </>
          ) : (
            <>
              <label className={labelClass}>
                Specifications
                <textarea rows={5} value={specsEn} onChange={(e) => setSpecsEn(e.target.value)} placeholder={"Material: leather\nColor: black\nSize: 30 x 20 cm"} className={`${inputClass} mt-1`} />
                <span className="mt-1 block text-xs font-normal text-muted">One line per item, as “Name: value”. Optional: the site shows the French text otherwise.</span>
              </label>
              <RichEditor label="Delivery and returns" rows={5} value={deliveryEn} onChange={setDeliveryEn} />
            </>
          )}
        </Section>

        <Section title={t("admin.section_price", { defaultValue: "Prix et stock" })}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              {t("admin.price_label")}
              <div className="relative mt-1">
                <input type="number" min={0} step={1} required inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} pr-16`} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted">FCFA</span>
              </div>
              {pricePreview && <span className="mt-1 block text-xs font-normal text-muted">= {pricePreview}</span>}
            </label>

            {product ? (
              <div>
                <span className={labelClass}>{t("admin.stock")}</span>
                <div className="mt-1 flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-line bg-page px-3">
                  <span className="font-bold">{product.stock ?? "—"}</span>
                  <Link to={`/admin/boutique/stock?q=${encodeURIComponent(product.name)}`} className="text-sm font-semibold text-primary hover:underline">
                    {t("admin.adjust_stock", { defaultValue: "Ajuster" })}
                  </Link>
                </div>
                <span className="mt-1 block text-xs text-muted">{t("admin.stock_from_stock_page", { defaultValue: "Le stock se modifie depuis la page Stock (avec historique)." })}</span>
              </div>
            ) : (
              <label className={labelClass}>
                {t("admin.stock")}
                <input type="number" min={0} step={1} required inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={`${inputClass} mt-1`} />
                <span className="mt-1 block text-xs font-normal text-muted">{t("admin.stock_initial_hint", { defaultValue: "Stock de départ, enregistré dans le journal." })}</span>
              </label>
            )}
          </div>
        </Section>

        <Section title={t("admin.image")} hint={t("admin.image_hint")}>
          <div className="flex flex-wrap items-start gap-4">
            {preview ? (
              <img src={preview} alt="" className="h-32 w-32 rounded-xl border border-line object-cover" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-dashed border-line bg-page text-xs text-muted">Aucune image</div>
            )}
            <div className="min-w-0 flex-1 space-y-2" style={{ minWidth: "12rem" }}>
              <label className={pickerClass}>
                <Svg d={UPLOAD} className="h-4 w-4" />
                {t("admin.image_choose", { defaultValue: "Choisir un fichier" })}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null)
                    setRemoveImage(false)
                    if (e.target.files?.[0]) setLink("")
                  }}
                />
              </label>
              <input
                type="url"
                placeholder={t("admin.image_link")}
                value={link}
                onChange={(e) => { setLink(e.target.value); setFile(null); setRemoveImage(false) }}
                className={inputClass}
              />
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
          </div>
        </Section>

        {product ? (
          <Section
            title={t("admin.gallery", { defaultValue: "Images supplémentaires" })}
            hint={galleryBusy ? t("admin.gallery_sending", { defaultValue: "Envoi en cours…" }) : t("admin.gallery_hint", { defaultValue: "JPG, PNG ou WebP, 4 Mo maximum par image, 12 images maximum." })}
          >
            {gallery.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {gallery.map((g, i) => (
                  <li key={g.id} className="relative">
                    <img src={g.url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                    <button
                      type="button"
                      onClick={() => void removeGallery(g.id)}
                      disabled={galleryBusy}
                      aria-label={t("admin.image_remove")}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-sm font-bold text-white shadow-sm disabled:opacity-60"
                    >
                      ×
                    </button>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button type="button" aria-label="Avancer" disabled={galleryBusy || i === 0} onClick={() => void moveGallery(i, -1)} className={miniBtn}>←</button>
                      <button
                        type="button" disabled={galleryBusy} onClick={() => void makeCover(g.id)}
                        className="min-h-[28px] flex-1 rounded-md border border-line px-1 text-[11px] font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-50"
                      >
                        Couverture
                      </button>
                      <button type="button" aria-label="Reculer" disabled={galleryBusy || i === gallery.length - 1} onClick={() => void moveGallery(i, 1)} className={miniBtn}>→</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <label className={pickerClass}>
              <Svg d={UPLOAD} className="h-4 w-4" />
              {t("admin.gallery_add", { defaultValue: "Ajouter des images" })}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={galleryBusy}
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  void addGallery(files)
                }}
              />
            </label>
            {galleryError && <p className="text-sm text-danger">{galleryError}</p>}
          </Section>
        ) : (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted">
            {t("admin.gallery_new", { defaultValue: "Enregistrez le produit, puis rouvrez-le pour ajouter d'autres images." })}
          </p>
        )}

        <Section title={t("admin.section_org", { defaultValue: "Organisation" })}>
          <label className={labelClass}>
            {t("admin.category", { defaultValue: "Catégorie" })}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{t("admin.no_category", { defaultValue: "Sans catégorie" })}</option>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-page px-3 py-3">
            <div>
              <p className="text-sm font-semibold">{t("admin.published_label")}</p>
              <p className="text-xs text-muted">{published ? "Visible dans la boutique." : "Masqué : brouillon, invisible pour les clients."}</p>
            </div>
            <Switch checked={published} onChange={setPublished} label={t("admin.published_label")} />
          </div>
        </Section>
      </form>
    </Drawer>
  )
}