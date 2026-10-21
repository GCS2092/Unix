import { useState, type ChangeEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { courseCoverApi } from "../../api/courseCover"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

const MAX_BYTES = 4 * 1024 * 1024
const btn =
  "inline-flex min-h-[40px] cursor-pointer items-center rounded-lg border border-dashed border-line bg-surface px-3.5 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5"

/** Images supplémentaires d'une formation : envoi multiple, retrait immédiat. */
export default function CourseGalleryField({ slug, initial }: { slug: string; initial?: { id: number; url: string }[] }) {
  const qc = useQueryClient()
  const [items, setItems] = useState(initial ?? [])
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    for (const k of ["admin-courses", "courses-catalog", "course-public"]) void qc.invalidateQueries({ queryKey: [k] })
  }

  async function add(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    setBusy(true)
    try {
      for (const f of files) {
        if (f.size > MAX_BYTES) { toast.error(`${f.name} : image trop lourde (4 Mo maximum).`); continue }
        const res = await courseCoverApi.addImage(slug, f)
        setItems(res.data.data.gallery ?? [])
      }
      refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setBusy(true)
    try {
      const res = await courseCoverApi.removeImage(slug, id)
      setItems(res.data.data.gallery ?? [])
      refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Images supplémentaires <span className="font-normal text-muted">({items.length}/12)</span></p>
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((g) => (
            <li key={g.id} className="relative">
              <img src={g.url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
              <button
                type="button" disabled={busy} onClick={() => void remove(g.id)} aria-label="Retirer l'image"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-sm font-bold text-white shadow-sm disabled:opacity-60"
              >×</button>
            </li>
          ))}
        </ul>
      )}
      <label className={`${btn} ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "Envoi en cours…" : "Ajouter des images"}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void add(e)} disabled={busy} />
      </label>
      <p className="text-xs text-muted">JPG, PNG ou WebP, 4 Mo maximum par image. Conseil : dans la description, écrivez « ## Titre » et « - puce » pour structurer le texte.</p>
    </div>
  )
}