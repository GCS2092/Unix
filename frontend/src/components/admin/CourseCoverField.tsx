import type { ChangeEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { courseCoverApi } from "../../api/courseCover"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

const btn =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const MAX_BYTES = 4 * 1024 * 1024

/** Photo de couverture d'une formation : envoi et retrait immediats. */
export default function CourseCoverField({ slug, imageUrl }: { slug: string; imageUrl?: string | null }) {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries()
  }
  const up = useMutation({
    mutationFn: (file: File) => courseCoverApi.upload(slug, file),
    onSuccess: () => { toast.success("Photo enregistrée."); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const rm = useMutation({
    mutationFn: () => courseCoverApi.remove(slug),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_BYTES) { toast.error("Image trop lourde (4 Mo maximum)."); return }
    up.mutate(file)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Photo de la formation</p>
      {imageUrl
        ? <img src={imageUrl} alt="" className="h-32 w-full max-w-xs rounded-lg border border-line object-cover" />
        : <div className="grid h-32 w-full max-w-xs place-items-center rounded-lg border border-dashed border-line text-xs text-muted">Aucune photo</div>}
      <div className="flex gap-2">
        <label className={`${btn} inline-flex cursor-pointer items-center ${up.isPending ? "pointer-events-none opacity-50" : ""}`}>
          {imageUrl ? "Remplacer" : "Choisir une photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} disabled={up.isPending} />
        </label>
        {imageUrl && <button type="button" disabled={rm.isPending} onClick={() => rm.mutate()} className={`${btn} text-danger`}>Retirer</button>}
      </div>
    </div>
  )
}