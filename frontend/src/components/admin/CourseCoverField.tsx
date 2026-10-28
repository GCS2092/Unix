import { useMemo, useState, type ChangeEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { courseCoverApi } from "../../api/courseCover"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

const btn =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const MAX_BYTES = 4 * 1024 * 1024

/**
 * Photo de couverture d'une formation.
 * - Cours existant (slug) : envoi et retrait immediats.
 * - Nouveau cours (pas de slug) : la photo est gardee par le formulaire (pending) et envoyee apres la creation.
 */
export default function CourseCoverField({
  slug,
  imageUrl,
  pending,
  onPending,
}: {
  slug?: string
  imageUrl?: string | null
  pending?: File | null
  onPending?: (f: File | null) => void
}) {
  const qc = useQueryClient()
  const [url, setUrl] = useState<string | null>(imageUrl ?? null)
  const preview = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending])
  const shown = slug ? url : preview

  const refresh = () => {
    for (const k of ["admin-courses", "courses-catalog", "course-public"]) void qc.invalidateQueries({ queryKey: [k] })
  }
  const up = useMutation({
    mutationFn: (file: File) => courseCoverApi.upload(slug ?? "", file),
    onSuccess: (res) => {
      setUrl(res.data.data.image_url ?? null)
      toast.success("Photo enregistrée.")
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const rm = useMutation({
    mutationFn: () => courseCoverApi.remove(slug ?? ""),
    onSuccess: () => {
      setUrl(null)
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_BYTES) { toast.error("Image trop lourde (4 Mo maximum)."); return }
    if (!slug) { onPending?.(file); return }
    up.mutate(file)
  }
  const remove = () => {
    if (!slug) onPending?.(null)
    else rm.mutate()
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Photo de la formation</p>
      {shown
        ? <img src={shown} alt="" className="h-32 w-full max-w-xs rounded-lg border border-line object-cover" />
        : <div className="grid h-32 w-full max-w-xs place-items-center rounded-lg border border-dashed border-line text-xs text-muted">Aucune photo</div>}
      <div className="flex gap-2">
        <label className={`${btn} inline-flex cursor-pointer items-center ${up.isPending ? "pointer-events-none opacity-50" : ""}`}>
          {shown ? "Remplacer" : "Choisir une photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} disabled={up.isPending} />
        </label>
        {shown && <button type="button" disabled={rm.isPending} onClick={remove} className={`${btn} text-danger`}>Retirer</button>}
      </div>
      {!slug && pending && <p className="text-xs text-muted">Elle sera envoyée à la création du cours.</p>}
    </div>
  )
}