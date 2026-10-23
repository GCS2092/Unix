import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi, type ProductPayload } from "../../api/admin"
import { apiClient } from "../../api/client"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import RichEditor from "../../components/admin/RichEditor"
import { Drawer, Section, Svg, Switch } from "../../components/admin/ui"
import { inputClass, labelClass } from "../../components/admin/adminStyles"
import type { Product } from "../../types"

const UPLOAD = "M12 16V4M7 9l5-5 5 5M4 20h16"
const LAST = 4
const miniBtn =
  "grid h-9 w-9 flex-none place-items-center rounded-md border border-line bg-surface text-sm transition hover:bg-black/5 active:scale-95 disabled:opacity-30"
const pickerClass =
  "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/30"
const btnBase = "min-h-[44px] rounded-lg px-5 text-sm font-semibold transition active:scale-95 disabled:opacity-50"

function Stepper({ step, labels, onGo, canGo }: { step: number; labels: string[]; onGo: (n: number) => void; canGo: (n: number) => boolean }) {
  const pct = (step / (labels.length - 1)) * 100
  return (
    <nav aria-label="Progression" className="mb-1">
      <div className="relative mx-4">
        <div className="absolute left-0 right-0 top-4 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute left-0 top-4 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        <ol className="relative flex justify-between">
          {labels.map((l, i) => {
            const done = i < step
            const current = i === step
            const ok = canGo(i)
            return (
              <li key={l} className="flex w-0 flex-col items-center" aria-current={current ? "step" : undefined}>
                <button
                  type="button" disabled={!ok} onClick={() => onGo(i)} aria-label={l}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    done ? "border-primary bg-primary text-white"
                    : current ? "border-primary bg-surface text-primary ring-4 ring-primary/15"
                    : "border-line bg-surface text-muted"
                  } ${ok ? "cursor-pointer" : "cursor-default"}`}
                >
                  {done ? "✓" : i + 1}
                </button>
                <span className={`mt-1.5 hidden whitespace-nowrap text-xs font-semibold sm:block ${current ? "text-primary" : "text-muted"}`}>{l}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-primary sm:hidden">
        {step + 1} / {labels.length} · {labels[step]}
      </p>
    </nav>
  )
}

function LangTabs({ lang, setLang }: { lang: "fr" | "en"; setLang: (l: "fr" | "en") => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
          className={`min-h-[36px] rounded-md px-4 transition ${lang === l ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {l === "fr" ? "Français" : "English"}
        </button>
      ))}
    </div>
  )
}

export default function ProductFormDrawer({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const editing = product !== null
  const [step, setStep] = useState(0)
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

  const labels = [
    t("admin.step_info", { defaultValue: "Infos" }),
    t("admin.step_details", { defaultValue: "Détails" }),
    t("admin.step_price", { defaultValue: "Prix" }),
    t("admin.step_images", { defaultValue: "Images" }),
    t("admin.step_publish", { defaultValue: "Publication" }),
  ]
  const hints = [
    "Le nom et la description que verront les clients.",
    "Caractéristiques techniques, livraison et retours (facultatif).",
    "Prix de vente en FCFA et stock disponible.",
    "Une belle image principale fait vendre. Ajoutez-en d'autres si besoin.",
    "Dernière étape : catégorie et visibilité dans la boutique.",
  ]

  async function refreshProducts() {
    await queryClient.invalidateQueries({ queryKey: ["products"] })
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
  }

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
      await refreshProducts()
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
      await refreshProducts()
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
      await refreshProducts()
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
      await refreshProducts()
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

  function validate(s: number): string | null {
    if (s === 0 && !name.trim()) {
      setLang("fr")
      return t("admin.name_required", { defaultValue: "Le nom du produit est obligatoire." })
    }
    if (s === 2) {
      const p = Number(price)
      if (!Number.isInteger(p) || p < 0) return t("admin.price_error")
      if (!editing) {
        const st = Number(stock)
        if (!Number.isInteger(st) || st < 0) return t("admin.stock_error")
      }
    }
    return null
  }

  function validateAll(): { step: number; msg: string } | null {
    for (let s = 0; s <= LAST; s++) {
      const msg = validate(s)
      if (msg) return { step: s, msg }
    }
    return null
  }

  function go(n: number) {
    setError(null)
    setStep(n)
    document.querySelector("[data-product-body]")?.parentElement?.scrollTo({ top: 0, behavior: "smooth" })
  }

  function next() {
    const msg = validate(step)
    if (msg) return setError(msg)
    go(step + 1)
  }

  const canGo = (n: number) => editing || n <= step

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing && step < LAST) return next()
    setError(null)
    const bad = validateAll()
    if (bad) {
      go(bad.step)
      setError(bad.msg)
      return
    }
    save.mutate({
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      name_en: nameEn.trim() === "" ? null : nameEn.trim(),
      description_en: descriptionEn.trim() === "" ? null : descriptionEn,
      price: Number(price),
      stock: Number(stock),
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
  const catName = (cats.data ?? []).find((c) => String(c.id) === categoryId)?.name

  return (
    <Drawer
      open
      onClose={onClose}
      title={product ? t("admin.edit_title", { name: product.name }) : t("admin.new_product")}
      subtitle={product ? product.slug : t("admin.new_product_hint", { defaultValue: "Renseigne l'essentiel, tu pourras compléter ensuite." })}
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onClose} disabled={save.isPending} className={`${btnBase} px-3 text-muted hover:text-ink`}>
              {t("admin.cancel")}
            </button>
            <div className="ml-auto flex min-w-0 flex-1 justify-end gap-2 sm:flex-none">
              {step > 0 && (
                <button type="button" onClick={() => go(step - 1)} disabled={save.isPending} className={`${btnBase} flex-1 border border-line bg-surface hover:bg-black/5 sm:flex-none`}>
                  ← Précédent
                </button>
              )}
              {step < LAST && (
                <button
                  type="button" onClick={next}
                  className={`${btnBase} flex-1 sm:flex-none ${editing ? "border border-line bg-surface hover:bg-black/5" : "bg-primary text-white shadow-sm hover:bg-primary-dark"}`}
                >
                  Suivant →
                </button>
              )}
              {(editing || step === LAST) && (
                <button type="submit" form="product-form" disabled={save.isPending} className={`${btnBase} flex-1 bg-primary text-white shadow-sm hover:bg-primary-dark sm:flex-none sm:min-w-[150px]`}>
                  {save.isPending ? t("admin.saving") : editing ? t("admin.save") : "Créer le produit"}
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <form id="product-form" data-tour="pr-form" noValidate onSubmit={handleSubmit} className="space-y-4">
        <div data-product-body>
          <p className="mb-3 text-sm text-muted">{hints[step]}</p>
          <Stepper step={step} labels={labels} onGo={go} canGo={canGo} />
        </div>

        <div key={step} className="animate-fade-up space-y-4">
          {step === 0 && (
            <Section title={t("admin.section_info", { defaultValue: "Informations" })}>
              <LangTabs lang={lang} setLang={setLang} />
              {lang === "fr" ? (
                <>
                  <label className={labelClass}>
                    {t("admin.name")}
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
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
          )}

          {step === 1 && (
            <Section title={lang === "fr" ? "Caractéristiques et livraison" : "Specifications and delivery"}>
              <LangTabs lang={lang} setLang={setLang} />
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
          )}

          {step === 2 && (
            <Section title={t("admin.section_price", { defaultValue: "Prix et stock" })}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  {t("admin.price_label")}
                  <div className="relative mt-1">
                    <input type="number" min={0} step={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} pr-16`} />
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
                    <input type="number" min={0} step={1} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={`${inputClass} mt-1`} />
                    <span className="mt-1 block text-xs font-normal text-muted">{t("admin.stock_initial_hint", { defaultValue: "Stock de départ, enregistré dans le journal." })}</span>
                  </label>
                )}
              </div>
            </Section>
          )}

          {step === 3 && (
            <>
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
                    <ul className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
                      {gallery.map((g, i) => (
                        <li key={g.id} className="relative">
                          <img src={g.url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                          <button
                            type="button"
                            onClick={() => void removeGallery(g.id)}
                            disabled={galleryBusy}
                            aria-label={t("admin.image_remove")}
                            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-danger text-sm font-bold text-white shadow-sm disabled:opacity-60"
                          >
                            ×
                          </button>
                          <div className="mt-1.5 flex items-center gap-1">
                            <button type="button" aria-label="Avancer" disabled={galleryBusy || i === 0} onClick={() => void moveGallery(i, -1)} className={miniBtn}>←</button>
                            <button
                              type="button" disabled={galleryBusy} onClick={() => void makeCover(g.id)}
                              className="min-h-[36px] flex-1 rounded-md border border-line px-1 text-[11px] font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-50"
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
            </>
          )}

          {step === 4 && (
            <Section title={t("admin.section_org", { defaultValue: "Organisation" })}>
              <label className={labelClass}>
                {t("admin.category", { defaultValue: "Catégorie" })}
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">{t("admin.no_category", { defaultValue: "Sans catégorie" })}</option>
                  {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-page px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("admin.published_label")}</p>
                  <p className="text-xs text-muted">{published ? "Visible dans la boutique." : "Masqué : brouillon, invisible pour les clients."}</p>
                </div>
                <Switch checked={published} onChange={setPublished} label={t("admin.published_label")} />
              </div>

              <dl className="grid gap-2 rounded-xl bg-primary/5 p-4 text-sm sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-muted">Nom</dt><dd className="truncate font-semibold">{name.trim() || "—"}</dd></div>
                <div><dt className="text-xs text-muted">Prix</dt><dd className="font-semibold">{pricePreview ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">Stock</dt><dd className="font-semibold">{editing ? (product?.stock ?? "—") : stock}</dd></div>
                <div><dt className="text-xs text-muted">Catégorie</dt><dd className="truncate font-semibold">{catName ?? "Aucune"}</dd></div>
                <div><dt className="text-xs text-muted">Image principale</dt><dd className="font-semibold">{preview ? "Oui" : "Non"}</dd></div>
                <div><dt className="text-xs text-muted">Version anglaise</dt><dd className="font-semibold">{nameEn.trim() || descriptionEn.trim() ? "Renseignée" : "Non (français affiché)"}</dd></div>
              </dl>
            </Section>
          )}
        </div>
      </form>
    </Drawer>
  )
}
