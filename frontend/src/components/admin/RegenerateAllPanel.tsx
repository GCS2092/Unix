import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

const CHUNK = 10

/** Applique le modele actuel (design, QR code) aux certificats deja delivres, par lots. */
export default function RegenerateAllPanel() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function run() {
    if (progress) return
    try {
      const ids = (await apiClient.get<{ data: number[] }>("/admin/certificate-template/certificate-ids")).data.data
      if (ids.length === 0) {
        toast.info(L("Aucun certificat délivré.", "No issued certificates."))
        return
      }
      if (!window.confirm(L(
        `Régénérer ${ids.length} certificat(s) avec le modèle actuel ? Les codes de vérification et les dates ne changent pas.`,
        `Regenerate ${ids.length} certificate(s) with the current template? Codes and dates do not change.`,
      ))) return

      let ok = 0
      let failed = 0
      const problems: string[] = []
      setProgress({ done: 0, total: ids.length })
      try {
        for (let i = 0; i < ids.length; i += CHUNK) {
          const r = (await apiClient.post<{ data: { done: number; failed: number; messages: string[] } }>(
            "/admin/certificate-template/regenerate", { ids: ids.slice(i, i + CHUNK) },
          )).data.data
          ok += r.done
          failed += r.failed
          for (const m of r.messages) if (problems.length < 3) problems.push(m)
          setProgress({ done: Math.min(i + CHUNK, ids.length), total: ids.length })
        }
      } finally {
        setProgress(null)
        for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments"]) void qc.invalidateQueries({ queryKey: [k] })
      }
      if (ok > 0) toast.success(L(`${ok} certificat(s) régénéré(s).`, `${ok} certificate(s) regenerated.`))
      if (failed > 0) toast.error(`${L(`${failed} échec(s)`, `${failed} failure(s)`)} ${problems.join(" | ")}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="max-w-3xl space-y-3 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div>
        <h2 className="text-lg font-bold">{L("Appliquer le modèle aux certificats déjà délivrés", "Apply the template to issued certificates")}</h2>
        <p className="mt-1 text-sm text-muted">
          {L("Les anciens PDF gardent l'ancien design et n'ont pas de QR code. Cette action les régénère avec le modèle actuel. Code de vérification, date de délivrance et marqueur « Envoyé » sont conservés. Pensez à enregistrer le modèle avant.",
             "Old PDFs keep the previous design and have no QR code. This regenerates them with the current template. Verification code, issue date and the “Sent” marker are kept. Save the template first.")}
        </p>
      </div>
      <button
        type="button" disabled={progress !== null} onClick={() => void run()}
        className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
      >
        {progress ? `${L("Régénération", "Regenerating")} ${progress.done}/${progress.total}…` : L("Régénérer tous les certificats", "Regenerate all certificates")}
      </button>
      {progress && (
        <div role="status">
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </section>
  )
}