import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Award, Download, Eye, Link2 } from "lucide-react"
import { myCertificatesApi, type MyCert } from "../api/myCertificates"
import EmailCertificateButton from "../components/EmailCertificateButton"
import CertificatePreview from "../components/CertificatePreview"
import { ErrorState } from "../components/States"
import { Skeleton } from "../components/Skeleton"
import { getErrorMessage } from "../lib/errors"
import { saveBlob } from "../lib/download"
import { toast } from "../stores/toastStore"

const btn =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const btnPrimary =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "certificat"

async function blobMessage(err: unknown): Promise<string> {
  const body = (err as { response?: { data?: unknown } })?.response?.data
  if (body instanceof Blob) {
    try {
      const m = (JSON.parse(await body.text()) as { message?: string }).message
      if (m) return m
    } catch { /* corps non JSON */ }
  }
  return getErrorMessage(err)
}

export default function MyCertificatesPage() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [preview, setPreview] = useState<MyCert | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)

  const list = useQuery({
    queryKey: ["my-certificates"],
    queryFn: async () => (await myCertificatesApi.list()).data.data,
    staleTime: 0,
  })

  const obtain = useMutation({
    mutationFn: (enrollmentId: number) => myCertificatesApi.obtain(enrollmentId),
    onSuccess: () => { toast.success(L("Certificat délivré.", "Certificate issued.")); void qc.invalidateQueries({ queryKey: ["my-certificates"] }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(i18n.language, { day: "2-digit", month: "long", year: "numeric" }) : "-"

  async function download(row: MyCert) {
    const c = row.certificate
    if (!c || downloading !== null) return
    setDownloading(c.id)
    try {
      const res = await myCertificatesApi.download(c.id)
      saveBlob(res.data, `certificat-${slug(row.course_title ?? "")}.pdf`)
    } catch (e) {
      toast.error(await blobMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(L("Lien de vérification copié.", "Verification link copied."))
    } catch {
      toast.error(L("Copie impossible : ", "Could not copy: ") + url)
    }
  }

  const rows = list.data ?? []
  const mine = rows.filter((r) => r.status === "issued" || r.status === "revoked")
  const todo = rows.filter((r) => r.status === "ready" || r.status === "blocked" || r.status === "in_progress")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{L("Mes certificats", "My certificates")}</h2>
        <p className="mt-1 text-sm text-muted">
          {L("Consultez vos certificats, téléchargez-les en PDF ou partagez leur lien de vérification.", "View your certificates, download them as PDF or share their verification link.")}
        </p>
      </div>

      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.isLoading && <Skeleton className="h-40" />}

      {list.data && mine.length === 0 && (
        <div className="rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <Award className="mx-auto h-10 w-10 text-muted" aria-hidden="true" />
          <p className="mt-2 font-semibold">{L("Aucun certificat pour le moment", "No certificate yet")}</p>
          <p className="mt-1 text-sm text-muted">{L("Terminez une formation et réussissez l'examen final pour obtenir votre certificat.", "Complete a course and pass the final exam to get your certificate.")}</p>
          <Link to="/etudiant" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">{L("Voir mes formations", "See my courses")}</Link>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {mine.map((row) => {
            const c = row.certificate
            if (!c) return null
            const revoked = row.status === "revoked"
            return (
              <li key={row.enrollment_id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 flex-none place-items-center rounded-full ${revoked ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
                    <Award className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{row.course_title ?? "-"}</p>
                    <p className="mt-0.5 text-xs text-muted">{L("Délivré le ", "Issued on ")}{fmt(c.issued_at)}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted">{c.code}</p>
                  </div>
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-bold ${revoked ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                    {revoked ? L("Révoqué", "Revoked") : L("Valide", "Valid")}
                  </span>
                </div>

                {revoked ? (
                  <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{L("Ce certificat a été révoqué : il n'est plus téléchargeable. Contactez l'équipe pour plus d'informations.", "This certificate has been revoked and can no longer be downloaded. Contact the team for details.")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} onClick={() => setPreview(row)}>
                      <Eye className="h-4 w-4" aria-hidden="true" />{L("Aperçu", "Preview")}
                    </button>
                    <button type="button" className={btn} disabled={downloading === c.id} onClick={() => void download(row)}>
                      <Download className="h-4 w-4" aria-hidden="true" />{downloading === c.id ? L("Préparation…", "Preparing…") : L("Télécharger", "Download")}
                    </button>
                    <EmailCertificateButton enrollmentId={row.enrollment_id} />
                    <button type="button" className={btn} onClick={() => void copyLink(c.verify_url)}>
                      <Link2 className="h-4 w-4" aria-hidden="true" />{L("Lien de vérification", "Verification link")}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {todo.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-bold">{L("À débloquer", "To unlock")}</h3>
          <ul className="space-y-2">
            {todo.map((row) => (
              <li key={row.enrollment_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.course_title ?? "-"}</p>
                  <p className="text-xs text-muted">
                    {row.status === "ready" && L("Cours terminé et examen validé : votre certificat est prêt.", "Course completed and exam passed: your certificate is ready.")}
                    {row.status === "blocked" && L("Cours terminé : il reste à réussir l'examen final.", "Course completed: you still need to pass the final exam.")}
                    {row.status === "in_progress" && L(`Formation en cours : ${row.progress} %`, `Course in progress: ${row.progress}%`)}
                  </p>
                </div>
                {row.status === "ready" ? (
                  <button type="button" className={btnPrimary} disabled={obtain.isPending} onClick={() => obtain.mutate(row.enrollment_id)}>
                    <Award className="h-4 w-4" aria-hidden="true" />{obtain.isPending ? L("Génération…", "Generating…") : L("Obtenir mon certificat", "Get my certificate")}
                  </button>
                ) : (
                  <Link to={`/etudiant/cours/${row.enrollment_id}`} className={btn}>
                    {row.status === "blocked" ? L("Passer l'examen", "Take the exam") : L("Continuer", "Continue")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview?.certificate && (
        <CertificatePreview cert={preview.certificate} title={preview.course_title ?? L("Certificat", "Certificate")} onClose={() => setPreview(null)} L={L} />
      )}
    </div>
  )
}