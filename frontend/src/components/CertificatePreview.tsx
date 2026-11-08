import { useEffect, useState } from "react"
import { ExternalLink, X } from "lucide-react"
import { myCertificatesApi } from "../api/myCertificates"
import { getErrorMessage } from "../lib/errors"

const btn =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"

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

/** Apercu du PDF d'un certificat dans une fenetre (le fichier est lu avec la session de l'etudiant). */
export default function CertificatePreview({ cert, title, onClose, L }: { cert: { id: number }; title: string; onClose: () => void; L: (a: string, b: string) => string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let made: string | null = null
    let cancelled = false
    myCertificatesApi.view(cert.id)
      .then((res) => {
        if (cancelled) return
        made = URL.createObjectURL(res.data)
        setUrl(made)
      })
      .catch(async (e) => { if (!cancelled) setError(await blobMessage(e)) })
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made) }
  }, [cert.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-card-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="min-w-0 truncate font-semibold">{title}</p>
          <div className="flex flex-none items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className={btn}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />{L("Nouvel onglet", "New tab")}
              </a>
            )}
            <button type="button" onClick={onClose} aria-label={L("Fermer", "Close")} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-black/5">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-black/5">
          {!url && !error && <p className="p-6 text-center text-sm text-muted" role="status">{L("Chargement du certificat…", "Loading certificate…")}</p>}
          {error && <p role="alert" className="m-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {url && <iframe src={url} title={title} className="h-full w-full border-0" />}
        </div>
      </div>
    </div>
  )
}