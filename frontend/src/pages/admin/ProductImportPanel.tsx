import { useState } from "react"
import type { ChangeEvent, DragEvent } from "react"
import { isAxiosError } from "axios"
import { productImportApi } from "../../api/productImport"
import type { ImportReport } from "../../api/productImport"
import { saveBlob } from "../../lib/download"

const T = {
  title: "Importer des produits",
  hint: "Fichier .xlsx ou .csv, avec les titres de colonnes sur la premi\u00e8re ligne (nom, prix, stock\u2026). Une ligne en erreur n'emp\u00eache jamais les autres d'\u00eatre import\u00e9es.",
  drop: "Glissez un fichier ici ou cliquez pour le choisir",
  template: "T\u00e9l\u00e9charger le mod\u00e8le",
  publish: "Publier les nouveaux produits sur le site",
  preview: "Pr\u00e9visualiser",
  previewing: "Analyse\u2026",
  run: "Importer les lignes valides",
  running: "Import en cours\u2026",
  close: "Fermer",
  dryBanner: "Pr\u00e9visualisation : rien n'a \u00e9t\u00e9 enregistr\u00e9. V\u00e9rifiez le rapport puis lancez l'import.",
  doneBanner: "Import termin\u00e9. Le catalogue et le stock sont \u00e0 jour.",
  created: "Cr\u00e9\u00e9s",
  updated: "Mis \u00e0 jour",
  unchanged: "Inchang\u00e9s",
  skipped: "Ignor\u00e9s",
  total: "Lignes lues",
  unknownCols: "Colonnes non reconnues (ignor\u00e9es) :",
  issues: "Erreurs et avertissements",
  error: "Erreur",
  warning: "Avertissement",
  row: "Ligne",
  fieldCol: "Champ",
  product: "Produit",
  message: "Message",
  truncated: "Liste tronqu\u00e9e : corrigez les premi\u00e8res erreurs puis recommencez.",
  exportReport: "Exporter le rapport (CSV)",
  noIssue: "Aucun probl\u00e8me d\u00e9tect\u00e9.",
  details: "D\u00e9tail des lignes lues",
  actCreate: "Cr\u00e9ation",
  actUpdate: "Mise \u00e0 jour",
  actSame: "Inchang\u00e9",
  price: "Prix",
  stock: "Stock",
  xls: "Le format .xls n'est pas support\u00e9 : enregistrez le fichier en .xlsx ou .csv.",
  format: "Format non support\u00e9 : utilisez .xlsx ou .csv.",
  big: "Fichier trop gros (5 Mo maximum).",
  network: "Le serveur ne r\u00e9pond pas. V\u00e9rifiez votre connexion puis r\u00e9essayez.",
  generic: "Une erreur est survenue.",
  tooBig: "Fichier trop gros pour le serveur.",
}

const MAX_BYTES = 5 * 1024 * 1024
const btn = "min-h-[36px] rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50"
const btnGhost = `${btn} border-line bg-surface text-ink hover:border-primary`
const btnPrimary = `${btn} border-primary bg-primary text-white`

function errText(e: unknown): string {
  if (!isAxiosError(e)) return T.generic
  if (!e.response) return T.network
  if (e.response.status === 413) return T.tooBig
  const d = e.response.data as { message?: string; errors?: Record<string, string[]> } | undefined
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  return first ?? d?.message ?? T.generic
}

function csvCell(v: unknown): string {
  let s = String(v ?? "")
  if (s !== "" && ["=", "+", "-", "@"].includes(s[0])) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-page px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

interface Props {
  onDone: () => Promise<void>
  onClose: () => void
}

export default function ProductImportPanel({ onDone, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState<"preview" | "import" | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState("")
  const [drag, setDrag] = useState(false)

  function pick(f: File | null) {
    setReport(null)
    setError("")
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext === "xls") return setError(T.xls)
    if (!["xlsx", "csv", "txt"].includes(ext)) return setError(T.format)
    if (f.size > MAX_BYTES) return setError(T.big)
    setFile(f)
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0] ?? null)
    e.target.value = ""
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDrag(false)
    pick(e.dataTransfer.files[0] ?? null)
  }

  async function run(dry: boolean) {
    if (!file) return
    setBusy(dry ? "preview" : "import")
    setError("")
    try {
      const res = await productImportApi.run(file, { dryRun: dry, publish })
      setReport(res.data.data)
      if (!dry) await onDone()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(null)
    }
  }

  async function downloadTemplate() {
    try {
      const res = await productImportApi.template()
      saveBlob(res.data, "modele-import-produits.csv")
    } catch (e) {
      setError(errText(e))
    }
  }

  function exportReport() {
    if (!report) return
    const lines = [["Ligne", "Niveau", "Champ", "Produit", "Message"].map(csvCell).join(";")]
    for (const i of report.issues) {
      lines.push([i.row, i.level === "error" ? T.error : T.warning, i.field ?? "", i.name, i.message].map(csvCell).join(";"))
    }
    saveBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `rapport-import-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const errCount = report?.issues.filter((i) => i.level === "error").length ?? 0
  const warnCount = (report?.issues.length ?? 0) - errCount
  const actLabel = (a: string) => (a === "create" ? T.actCreate : a === "update" ? T.actUpdate : T.actSame)

  return (
    <div className="mb-4 rounded-card border border-primary/40 bg-surface p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{T.title}</h2>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => void downloadTemplate()}>{T.template}</button>
          <button type="button" className={btnGhost} onClick={onClose}>{T.close}</button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">{T.hint}</p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm transition ${
          drag ? "border-primary bg-primary/5" : "border-line bg-page hover:border-primary"}`}
      >
        <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={onInput} />
        {file
          ? <span className="font-semibold text-ink">{file.name} <span className="font-normal text-muted">({Math.max(1, Math.round(file.size / 1024))} Ko)</span></span>
          : <span className="text-muted">{T.drop}</span>}
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4" />
          {T.publish}
        </label>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button type="button" className={btnGhost} disabled={!file || busy !== null} onClick={() => void run(true)}>
            {busy === "preview" ? T.previewing : T.preview}
          </button>
          <button type="button" className={btnPrimary} disabled={!file || busy !== null} onClick={() => void run(false)}>
            {busy === "import" ? T.running : T.run}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      {report && (
        <div className="mt-4">
          <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${report.dry_run ? "bg-accent/15 text-amber-700" : "bg-success/10 text-success"}`}>
            {report.dry_run ? T.dryBanner : T.doneBanner}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label={T.total} value={report.total} />
            <Stat label={T.created} value={report.created} tone="text-success" />
            <Stat label={T.updated} value={report.updated} />
            <Stat label={T.unchanged} value={report.unchanged} tone="text-muted" />
            <Stat label={T.skipped} value={report.skipped} tone={report.skipped > 0 ? "text-danger" : ""} />
          </div>

          {report.unknown_columns.length > 0 && (
            <p className="mt-3 text-sm text-muted">{T.unknownCols} <span className="font-medium text-ink">{report.unknown_columns.join(", ")}</span></p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">
              {T.issues} ({errCount} {T.error.toLowerCase()}(s), {warnCount} {T.warning.toLowerCase()}(s))
            </h3>
            {report.issues.length > 0 && <button type="button" className={btnGhost} onClick={exportReport}>{T.exportReport}</button>}
          </div>

          {report.issues.length === 0 ? (
            <p className="mt-2 text-sm text-success">{T.noIssue}</p>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 border-b border-line bg-page text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">{T.row}</th>
                    <th className="px-3 py-2 font-medium">&nbsp;</th>
                    <th className="px-3 py-2 font-medium">{T.fieldCol}</th>
                    <th className="px-3 py-2 font-medium">{T.product}</th>
                    <th className="px-3 py-2 font-medium">{T.message}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.issues.map((i, idx) => (
                    <tr key={idx}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">{i.row}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${i.level === "error" ? "bg-danger/10 text-danger" : "bg-accent/15 text-amber-700"}`}>
                          {i.level === "error" ? T.error : T.warning}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted">{i.field ?? "-"}</td>
                      <td className="px-3 py-2">{i.name || "-"}</td>
                      <td className="px-3 py-2">{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.issues_truncated && <p className="mt-2 text-xs text-muted">{T.truncated}</p>}

          {report.preview.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-primary">{T.details}</summary>
              <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-line bg-page text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">{T.row}</th>
                      <th className="px-3 py-2 font-medium">{T.product}</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 text-right font-medium">{T.price}</th>
                      <th className="px-3 py-2 text-right font-medium">{T.stock}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.preview.map((p, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{p.row}</td>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2">{actLabel(p.action)}</td>
                        <td className="px-3 py-2 text-right">{p.price ?? "-"}</td>
                        <td className="px-3 py-2 text-right">{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}