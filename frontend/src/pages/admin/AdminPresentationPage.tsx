import { useState, type ChangeEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  normalizePresentation, presentationApi,
  type ImageSlot, type PItem, type PresentationContent, type PresentationSpace,
} from "../../api/presentation"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const inputClass =
  "mt-1 min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const btnMini =
  "grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-sm transition hover:bg-black/5 disabled:opacity-30"

type StrKey = Exclude<keyof PresentationContent, "steps" | "advantages" | "published" | "show_courses" | "show_faq" | "gallery_urls">
type Flag = "published" | "show_courses" | "show_faq"
const MAX_BYTES = 4 * 1024 * 1024

function Txt(props: { label: string; value: string; onChange: (v: string) => void; rows?: number; max?: number; placeholder?: string }) {
  const { label, value, onChange, rows, max, placeholder } = props
  return (
    <label className="block text-sm font-medium">
      {label}
      {rows ? (
        <textarea rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function ItemsEditor(props: { items: PItem[]; onChange: (v: PItem[]) => void; max: number; addLabel: string }) {
  const { items, onChange, max, addLabel } = props
  const upd = (i: number, k: keyof PItem, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted">Aucun élément : cette section sera masquée sur la page.</p>}
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted">#{i + 1}</span>
            <div className="flex gap-1.5">
              <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className={btnMini}>↑</button>
              <button type="button" aria-label="Descendre" disabled={i === items.length - 1} onClick={() => move(i, 1)} className={btnMini}>↓</button>
              <button type="button" aria-label="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))} className={`${btnMini} text-danger`}>✕</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Txt label="Titre (FR)" value={it.title_fr} max={80} onChange={(v) => upd(i, "title_fr", v)} />
              <Txt label="Texte (FR)" rows={3} value={it.text_fr} max={500} onChange={(v) => upd(i, "text_fr", v)} />
            </div>
            <div className="space-y-2">
              <Txt label="Title (EN)" value={it.title_en} max={80} onChange={(v) => upd(i, "title_en", v)} />
              <Txt label="Text (EN)" rows={3} value={it.text_en} max={500} onChange={(v) => upd(i, "text_en", v)} />
            </div>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className={btnGhost}
          onClick={() => onChange([...items, { title_fr: "", title_en: "", text_fr: "", text_en: "" }])}>
          {addLabel}
        </button>
      )}
    </div>
  )
}

function ImagesCard({ space, data }: { space: PresentationSpace; data: PresentationContent }) {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-presentation", space] })
    void qc.invalidateQueries({ queryKey: ["presentation"] })
  }
  const up = useMutation({
    mutationFn: (v: { slot: ImageSlot; file: File }) => presentationApi.uploadImage(space, v.slot, v.file),
    onSuccess: () => { toast.success("Image enregistrée."); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const rm = useMutation({
    mutationFn: (v: { slot: ImageSlot; index?: number }) => presentationApi.removeImage(space, v.slot, v.index),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pick = (slot: ImageSlot) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_BYTES) { toast.error("Image trop lourde (4 Mo maximum)."); return }
    up.mutate({ slot, file })
  }

  const chooser = (slot: ImageSlot, label: string) => (
    <label className={`${btnGhost} inline-flex cursor-pointer items-center ${up.isPending ? "pointer-events-none opacity-50" : ""}`}>
      {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick(slot)} disabled={up.isPending} />
    </label>
  )

  const single = (slot: "hero" | "story", title: string, hint: string, url: string) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      {url
        ? <img src={url} alt="" className="h-40 w-full rounded-lg border border-line object-cover" />
        : <div className="grid h-40 w-full place-items-center rounded-lg border border-dashed border-line text-xs text-muted">Aucune image</div>}
      <div className="flex gap-2">
        {chooser(slot, url ? "Remplacer" : "Choisir une image")}
        {url && <button type="button" disabled={rm.isPending} onClick={() => rm.mutate({ slot })} className={`${btnGhost} text-danger`}>Retirer</button>}
      </div>
    </div>
  )

  return (
    <Card title="Images" hint="JPG, PNG ou WebP, 4 Mo maximum (2 Mo si la limite PHP n'a pas été augmentée). Les images paysage fonctionnent le mieux.">
      <div className="grid gap-4 md:grid-cols-2">
        {single("hero", "Image du bandeau", "Grande image en haut de la page.", data.hero_image_url)}
        {single("story", "Image de la présentation", "À côté du texte de présentation.", data.story_image_url)}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Galerie ({data.gallery_urls.length}/8)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.gallery_urls.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="h-24 w-full rounded-lg border border-line object-cover" />
              <button type="button" aria-label="Retirer l'image" disabled={rm.isPending}
                onClick={() => rm.mutate({ slot: "gallery", index: i })}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs text-white">✕</button>
            </div>
          ))}
        </div>
        {data.gallery_urls.length < 8 && chooser("gallery", "Ajouter une photo")}
      </div>
    </Card>
  )
}

const clean = (list: PItem[]) => list.filter((it) => it.title_fr.trim() !== "" || it.text_fr.trim() !== "")

function Editor({ space, initial, data }: { space: PresentationSpace; initial: PresentationContent; data: PresentationContent }) {
  const qc = useQueryClient()
  const [f, setF] = useState<PresentationContent>(initial)
  const [error, setError] = useState<string | null>(null)
  const text = (k: StrKey) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const flag = (k: Flag) => (v: boolean) => setF((s) => ({ ...s, [k]: v }))

  const save = useMutation({
    mutationFn: () => presentationApi.adminSave(space, { ...f, steps: clean(f.steps), advantages: clean(f.advantages) }),
    onSuccess: () => {
      toast.success("Page enregistrée.")
      setError(null)
      void qc.invalidateQueries({ queryKey: ["admin-presentation", space] })
      void qc.invalidateQueries({ queryKey: ["presentation"] })
    },
    onError: (e) => {
      const fe = getFieldErrors(e)
      setError(
        Object.keys(fe).length > 0
          ? `Vérifiez les champs (chaque étape ou avantage a besoin d'un titre et d'un texte en français). ${Object.values(fe).join(" ")}`
          : getErrorMessage(e),
      )
    },
  })

  const check = (label: string, k: Flag) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="h-4 w-4" checked={f[k]} onChange={(e) => flag(k)(e.target.checked)} />
      {label}
    </label>
  )

  const viewHref = space === "home" ? "/decouvrir" : space === "shop" ? "/decouvrir/boutique" : "/decouvrir/formations"

  return (
    <div className="space-y-4">
      <ImagesCard space={space} data={data} />

      <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-4">
        <Card title="Publication">
          {check("Page publiée (visible par les visiteurs)", "published")}
          {space !== "home" && check("Afficher un aperçu de la FAQ", "show_faq")}
          {space === "formation" && check("Afficher les formations du catalogue (cartes avec image)", "show_courses")}
        </Card>

        <Card title="Bandeau d'accueil" hint="Titre et sous-titre en grand, sur l'image du bandeau.">
          <div className="grid gap-3 md:grid-cols-2">
            <Txt label="Titre (FR)" value={f.hero_title_fr} max={120} onChange={text("hero_title_fr")} />
            <Txt label="Title (EN)" value={f.hero_title_en} max={120} onChange={text("hero_title_en")} />
            <Txt label="Sous-titre (FR)" rows={2} value={f.hero_subtitle_fr} max={300} onChange={text("hero_subtitle_fr")} />
            <Txt label="Subtitle (EN)" rows={2} value={f.hero_subtitle_en} max={300} onChange={text("hero_subtitle_en")} />
          </div>
        </Card>

        <Card title={space === "home" ? "Notre histoire" : "Présentation"} hint="Racontez votre histoire ou présentez l'activité (facultatif). Le titre par défaut est « Notre histoire ».">
          <div className="grid gap-3 md:grid-cols-2">
            <Txt label="Titre de la section (FR)" value={f.intro_title_fr} max={120} onChange={text("intro_title_fr")} />
            <Txt label="Section title (EN)" value={f.intro_title_en} max={120} onChange={text("intro_title_en")} />
            <Txt label="Texte (FR)" rows={7} value={f.intro_fr} max={3000} onChange={text("intro_fr")} />
            <Txt label="Text (EN)" rows={7} value={f.intro_en} max={3000} onChange={text("intro_en")} />
          </div>
        </Card>

        <Card title="Comment ça se passe" hint="Étapes numérotées, 6 au maximum.">
          <ItemsEditor items={f.steps} max={6} addLabel="Ajouter une étape" onChange={(v) => setF((s) => ({ ...s, steps: v }))} />
        </Card>

        <Card title="Avantages" hint="Points forts, 8 au maximum (facultatif).">
          <ItemsEditor items={f.advantages} max={8} addLabel="Ajouter un avantage" onChange={(v) => setF((s) => ({ ...s, advantages: v }))} />
        </Card>

        <Card title="Lieu" hint="Laissez vide pour masquer la section.">
          <Txt label="Nom du lieu" value={f.location_name} max={120} onChange={text("location_name")} />
          <div className="grid gap-3 md:grid-cols-2">
            <Txt label="Adresse (FR)" value={f.location_address_fr} max={255} onChange={text("location_address_fr")} />
            <Txt label="Address (EN)" value={f.location_address_en} max={255} onChange={text("location_address_en")} />
            <Txt label="Horaires (FR)" value={f.location_hours_fr} max={255} onChange={text("location_hours_fr")} />
            <Txt label="Opening hours (EN)" value={f.location_hours_en} max={255} onChange={text("location_hours_en")} />
          </div>
          <Txt label="Lien de la carte (Google Maps...)" placeholder="https://" value={f.location_map_url} max={500} onChange={text("location_map_url")} />
        </Card>

        <Card title="Contact" hint="Le bouton WhatsApp utilise déjà le numéro du site. Ajoutez un téléphone et un e-mail si vous voulez.">
          <div className="grid gap-3 md:grid-cols-2">
            <Txt label="Téléphone" value={f.contact_phone} max={30} onChange={text("contact_phone")} />
            <Txt label="E-mail" value={f.contact_email} max={255} onChange={text("contact_email")} />
          </div>
        </Card>

        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>{save.isPending ? "Enregistrement..." : "Enregistrer les textes"}</button>
          <a href={viewHref} target="_blank" rel="noopener noreferrer" className={`${btnGhost} inline-flex items-center`}>Voir la page</a>
        </div>
        <p className="text-xs text-muted">Les images sont enregistrées dès l'envoi. Les textes le sont avec le bouton « Enregistrer les textes ».</p>
      </form>
    </div>
  )
}

export default function AdminPresentationPage() {
  const [space, setSpace] = useState<PresentationSpace>("home")
  const q = useQuery({
    queryKey: ["admin-presentation", space],
    queryFn: async () => normalizePresentation((await presentationApi.adminGet(space)).data.data),
    staleTime: 0,
  })

  const tabs: { id: PresentationSpace; label: string }[] = [
    { id: "home", label: "Accueil (commun)" },
    { id: "shop", label: "Boutique" },
    { id: "formation", label: "Formations" },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Pages de présentation</h1>
        <p className="text-sm text-muted">Une page d'accueil commune et une page par section, gérées ici par l'administration générale.</p>
      </div>
      <div role="tablist" data-tour="pres-tabs" className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={space === x.id} onClick={() => setSpace(x.id)}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition ${
              space === x.id ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {q.isLoading && <p className="text-sm text-muted">Chargement...</p>}
      {q.isError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(q.error)}</p>}
      {q.data && <Editor key={space} space={space} initial={q.data} data={q.data} />}
    </div>
  )
}

