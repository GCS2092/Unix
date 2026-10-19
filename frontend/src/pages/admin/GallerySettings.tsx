import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { aboutApi, aboutGalleryApi, aboutVisibilityApi, GALLERY_SECTIONS, type GalleryItem, type GallerySection } from "../../api/about"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { Svg } from "../../components/admin/ui"
import { ImageDrop } from "../../components/admin/SettingsUi"

const MAX_BYTES = 2 * 1024 * 1024
const MAX_IMAGES = 3
const I_EYE = "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z"
const I_EYE_OFF = "M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 6.6A16.6 16.6 0 002 12s4 7 10 7a9.7 9.7 0 004.4-1M9.9 9.9a3 3 0 004.2 4.2"
const I_PLUS = "M12 5v14M5 12h14"
const I_X = "M6 6l12 12M18 6L6 18"

const roundBtn = "flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur transition hover:bg-ink active:scale-95 disabled:opacity-50"

function Block({ section, title, items }: { section: GallerySection; title: string; items: GalleryItem[] }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const visible = items.filter((i) => !i.hidden).length

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-banners"] })
    await qc.invalidateQueries({ queryKey: ["about"] })
  }
  const up = useMutation({
    mutationFn: (file: File) => aboutGalleryApi.upload(section, file),
    onSuccess: async () => { toast.success(fr ? "Image ajoutée" : "Image added"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const del = useMutation({
    mutationFn: (index: number) => aboutGalleryApi.remove(section, index),
    onSuccess: async () => { toast.success(fr ? "Image supprimée" : "Image removed"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const vis = useMutation({
    mutationFn: (p: { index: number; hidden: boolean }) => aboutVisibilityApi.gallery(section, p.index, p.hidden),
    onSuccess: async (_r, p) => {
      toast.success(p.hidden ? (fr ? "Image masquée du site." : "Image hidden from the site.") : (fr ? "Image visible sur le site." : "Image visible on the site."))
      await done()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function pick(file?: File) {
    if (!file) return
    if (items.length >= MAX_IMAGES) {
      toast.error(fr ? "3 images maximum par section." : "3 images max per section.")
      return
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error(fr ? "Format non accepté (JPG, PNG ou WebP)." : "Unsupported format (JPG, PNG or WebP).")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(fr ? "Image trop lourde (2 Mo maximum)." : "Image too large (2 MB max).")
      return
    }
    up.mutate(file)
  }

  return (
    <div className="space-y-2.5 rounded-card border border-line bg-page/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs text-muted">{fr ? `${visible} visible(s) · ${items.length}/${MAX_IMAGES}` : `${visible} visible · ${items.length}/${MAX_IMAGES}`}</span>
      </div>
      <ImageDrop onFile={pick} disabled={up.isPending}>
        <div className="grid grid-cols-3 gap-2">
          {items.map((it, i) => (
            <div key={it.url} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface">
              <img src={it.url} alt="" className={`h-full w-full object-cover transition ${it.hidden ? "opacity-40 grayscale" : ""}`} />
              {it.hidden && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                  {fr ? "Masquée" : "Hidden"}
                </span>
              )}
              <div className="absolute right-1 top-1 flex flex-col gap-1">
                <button type="button" data-tour={i === 0 ? "set-eye" : undefined} className={roundBtn} disabled={vis.isPending}
                  aria-label={it.hidden ? (fr ? "Afficher" : "Show") : (fr ? "Masquer" : "Hide")}
                  title={it.hidden ? (fr ? "Afficher sur le site" : "Show on the site") : (fr ? "Masquer du site" : "Hide from the site")}
                  onClick={() => vis.mutate({ index: i, hidden: !it.hidden })}>
                  <Svg d={it.hidden ? I_EYE_OFF : I_EYE} className="h-4 w-4" />
                </button>
                <button type="button" className={`${roundBtn} hover:!bg-danger`} disabled={del.isPending}
                  aria-label={fr ? "Supprimer" : "Remove"} title={fr ? "Supprimer" : "Remove"}
                  onClick={() => del.mutate(i)}>
                  <Svg d={I_X} className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length < MAX_IMAGES && (
            <button type="button" disabled={up.isPending} onClick={() => input.current?.click()}
              aria-label={fr ? "Ajouter une image" : "Add image"}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line bg-surface text-muted transition hover:border-primary hover:text-primary disabled:opacity-60">
              <Svg d={I_PLUS} className="h-6 w-6" />
              <span className="text-[11px] font-medium">{up.isPending ? "…" : (fr ? "Ajouter" : "Add")}</span>
            </button>
          )}
        </div>
      </ImageDrop>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
    </div>
  )
}

export default function GallerySettings() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await aboutApi.adminGet()).data.data,
    staleTime: 0,
  })

  return (
    <section data-tour="set-gallery" className="max-w-2xl space-y-5 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div>
        <h3 className="font-semibold">{fr ? "Images des sections" : "Section images"}</h3>
        <p className="mt-1 text-xs text-muted">
          {fr
            ? "Jusqu'à 3 images par section, alignées sur la page À propos. Glissez-déposez ou cliquez sur « Ajouter ». L'œil masque une image sans la supprimer."
            : "Up to 3 images per section, aligned on the About page. Drag and drop or click “Add”. The eye hides an image without deleting it."}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {GALLERY_SECTIONS.map((s) => (
          <Block key={s.key} section={s.key} title={fr ? s.fr : s.en} items={data?.[`gallery_${s.key}_items` as const] ?? []} />
        ))}
      </div>
    </section>
  )
}