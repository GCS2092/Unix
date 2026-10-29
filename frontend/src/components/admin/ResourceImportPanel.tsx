import { useState } from "react"
import type { ChangeEvent, DragEvent } from "react"
import { isAxiosError } from "axios"
import { resourceImportApi } from "../../api/resourceImport"
import type { GenericAnalyzeResult, ImportScope, ResourceReport } from "../../api/resourceImport"
import type { Confidence } from "../../api/productImport"
import { saveBlob } from "../../lib/download"

const EXTS = ["xlsx", "ods", "csv", "txt", "json"]
const MAX_BYTES = 10 * 1024 * 1024
const btn = "min-h-[36px] rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50"
const btnGhost = `${btn} border-line bg-surface text-ink hover:border-primary`
const btnPrimary = `${btn} border-primary bg-primary text-white`
const selectCls = "block min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"

const CONF: Record<Confidence, { label: string; cls: string }> = {
  saved: { label: "Mémorisé", cls: "bg-primary/10 text-primary" },
  high: { label: "Reconnu", cls: "bg-success/10 text-success" },
  medium: { label: "Deviné", cls: "bg-accent/15 text-amber-700" },
  low: { label: "À vérifier", cls: "bg-accent/15 text-amber-700" },
  none: { label: "Non reconnu", cls: "bg-line/70 text-muted" },
}

const ACTION: Record<string, string> = { create: "Création", update: "Mise à jour", unchanged: "Inchangé" }

function errText(e: unknown): string {
  if (!isAxiosError(e)) return "Une erreur est survenue."
  if (!e.response) return "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez."
  if (e.response.status === 413) return "Fichier trop gros pour le serveur."
  const d = e.response.data as { message?: string; errors?: Record<string, string[]> } | undefined
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  return first ?? d?.message ?? "Une erreur est survenue."
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
  scope: ImportScope
  resource: string
  title: string
  onDone: () => Promise<void>
  onClose: () => void
}

export default function ResourceImportPanel({ scope, resource, title, onDone, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<GenericAnalyzeResult | null>(null)
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [lineInput, setLineInput] = useState("1")
  const [remember, setRemember] = useState(true)
  const [mode, setMode] = useState<"both" | "create" | "update">("both")
  const [busy, setBusy] = useState<"analyze" | "preview" | "import" | null>(null)
  const [report, setReport] = useState<ResourceReport | null>(null)
  const [error, setError] = useState("")
  const [drag, setDrag] = useState(false)

  async function analyze(f: File, sheet?: number, line?: number) {
    setBusy("analyze")
    setError("")
    setReport(null)
    try {
      const a = (await resourceImportApi.analyze(scope, resource, f, sheet, line)).data.data
      const m: Record<number, string> = {}
      for (const c of a.columns) m[c.index] = c.field ?? ""
      setAnalysis(a)
      setMapping(m)
      setLineInput(String(a.header_line))
    } catch (e) {
      setAnalysis(null)
      setError(errText(e))
    } finally {
      setBusy(null)
    }
  }

  function pick(f: File | null) {
    setReport(null)
    setError("")
    setAnalysis(null)
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext === "xls") return setError("Le format .xls n'est pas supporté : enregistrez le fichier en .xlsx, .ods ou .csv.")
    if (!EXTS.includes(ext)) return setError("Format non supporté : utilisez .xlsx, .ods, .csv ou .json.")
    if (f.size > MAX_BYTES) return setError("Fichier trop gros (10 Mo maximum).")
    setFile(f)
    void analyze(f)
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

  function setField(index: number, field: string) {
    setMapping((prev) => {
      const next = { ...prev }
      if (field) {
        for (const k of Object.keys(next)) {
          if (Number(k) !== index && next[Number(k)] === field) next[Number(k)] = ""
        }
      }
      next[index] = field
      return next
    })
    setReport(null)
  }

  const mappedFields = Object.values(mapping).filter(Boolean)
  const idFields = analysis?.fields.filter((f) => f.identifies) ?? []
  const hasId = idFields.some((f) => mappedFields.includes(f.key))
  const canRun = !!file && !!analysis && hasId && busy === null

  async function run(dry: boolean) {
    if (!file || !analysis) return
    setBusy(dry ? "preview" : "import")
    setError("")
    try {
      const res = await resourceImportApi.run(scope, resource, file, {
        dryRun: dry, mode, mapping, sheet: analysis.sheet, headerLine: analysis.header_line, remember,
      })
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
      saveBlob((await resourceImportApi.template(scope, resource)).data, `modele-import-${resource}.xlsx`)
    } catch (e) {
      setError(errText(e))
    }
  }

  function exportIssues() {
    if (!report) return
    const lines = [["Ligne", "Niveau", "Champ", "Élément", "Message"].map(csvCell).join(";")]
    for (const i of report.issues) {
      lines.push([i.row, i.level === "error" ? "Erreur" : "Avertissement", i.field ?? "", i.name, i.message].map(csvCell).join(";"))
    }
    saveBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `rapport-import-${resource}.csv`)
  }

  function exportRejected() {
    if (!report?.rejected?.length || !analysis) return
    const keys = analysis.fields.map((f) => f.key)
    const lines = [[...keys, "erreur"].map(csvCell).join(";")]
    for (const r of report.rejected) lines.push([...keys.map((k) => r.data[k] ?? ""), r.reason].map(csvCell).join(";"))
    saveBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `lignes-refusees-${resource}.csv`)
  }

  const errCount = report?.issues.filter((i) => i.level === "error").length ?? 0
  const warnCount = (report?.issues.length ?? 0) - errCount

  return (
    <div className="mt-3 rounded-card border border-primary/40 bg-surface p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Importer : {title}</h2>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => void downloadTemplate()}>Télécharger le modèle</button>
          <button type="button" className={btnGhost} onClick={onClose}>Fermer</button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">
        Fichier .xlsx, .ods, .csv ou .json. Les colonnes sont reconnues automatiquement et vous pouvez corriger la correspondance avant d'importer. Une ligne en erreur n'empêche jamais les autres d'être importées.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm transition ${drag ? "border-primary bg-primary/5" : "border-line bg-page hover:border-primary"}`}
      >
        <input type="file" accept=".xlsx,.ods,.csv,.txt,.json" className="sr-only" onChange={onInput} />
        {file
          ? <span className="font-semibold text-ink">{file.name} <span className="font-normal text-muted">({Math.max(1, Math.round(file.size / 1024))} Ko)</span></span>
          : <span className="text-muted">Glissez un fichier ici ou cliquez pour le choisir</span>}
      </label>

      {busy === "analyze" && <p role="status" className="mt-3 text-sm text-muted">Lecture du fichier…</p>}

      {analysis && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-page p-3 text-sm">
            {analysis.sheets.length > 1 && (
              <label className="block">
                <span className="font-medium">Feuille</span>
                <select className={`${selectCls} mt-1 min-w-[10rem]`} value={analysis.sheet} disabled={busy !== null}
                  onChange={(e) => file && void analyze(file, Number(e.target.value))}>
                  {analysis.sheets.map((s) => <option key={s.index} value={s.index}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="font-medium">Ligne des titres</span>
              <input type="number" min={1} max={500} value={lineInput} onChange={(e) => setLineInput(e.target.value)} className={`${selectCls} mt-1 w-28`} />
            </label>
            <button type="button" className={btnGhost}
              disabled={busy !== null || !lineInput || Number(lineInput) === analysis.header_line}
              onClick={() => file && void analyze(file, analysis.sheet, Number(lineInput))}>
              Relire
            </button>
            <p className="ml-auto text-xs text-muted">
              {analysis.total_rows > analysis.max_rows ? `Plus de ${analysis.max_rows}` : analysis.total_rows} ligne(s) de données
            </p>
          </div>

          {analysis.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-accent/15 px-3 py-2 text-sm text-amber-700">
              {analysis.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Correspondance des colonnes</h3>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {analysis.columns.map((c) => {
                const current = mapping[c.index] ?? ""
                const conf: Confidence = current === "" && c.confidence !== "none" ? "none" : c.confidence
                return (
                  <li key={c.index} className="grid gap-2 px-3 py-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_13rem] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.header || "(sans titre)"}</p>
                      {c.note && <p className="text-xs text-amber-700">{c.note}</p>}
                    </div>
                    <p className="min-w-0 truncate text-xs text-muted">{c.samples.length ? c.samples.join(" · ") : "—"}</p>
                    <div className="flex items-center gap-2">
                      <select aria-label={`Champ pour ${c.header || "cette colonne"}`} className={selectCls} value={current}
                        onChange={(e) => setField(c.index, e.target.value)}>
                        <option value="">— Ignorer —</option>
                        {analysis.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                      {current !== "" && (
                        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold lg:inline ${CONF[conf].cls}`}>{CONF[conf].label}</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {!hasId && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                Associez au moins une colonne d'identification : {idFields.map((f) => `« ${f.label} »`).join(", ")}.
              </p>
            )}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" />
              Retenir ces correspondances pour les prochains fichiers
            </label>
          </div>

          <div className="grid gap-3 rounded-lg border border-line bg-page p-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Que faire des lignes du fichier ?</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as "both" | "create" | "update")} className={`${selectCls} mt-1`}>
                <option value="both">Créer les nouveaux et mettre à jour les existants</option>
                <option value="create">Créer seulement les nouveaux</option>
                <option value="update">Mettre à jour seulement les existants</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end justify-start gap-2 sm:justify-end">
              <button type="button" className={btnGhost} disabled={!canRun} onClick={() => void run(true)}>
                {busy === "preview" ? "Analyse…" : "Prévisualiser"}
              </button>
              <button type="button" className={btnPrimary} disabled={!canRun} onClick={() => void run(false)}>
                {busy === "import" ? "Import en cours…" : "Importer les lignes valides"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      {report && (
        <div className="mt-4">
          <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${report.dry_run ? "bg-accent/15 text-amber-700" : "bg-success/10 text-success"}`}>
            {report.dry_run ? "Prévisualisation : rien n'a été enregistré. Vérifiez le rapport puis lancez l'import." : "Import terminé."}
          </p>
          {(report.warnings?.length ?? 0) > 0 && (
            <ul className="mb-3 space-y-1 text-sm text-amber-700">{report.warnings?.map((w, i) => <li key={i}>• {w}</li>)}</ul>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Lignes lues" value={report.total} />
            <Stat label="Créés" value={report.created} tone="text-success" />
            <Stat label="Mis à jour" value={report.updated} />
            <Stat label="Inchangés" value={report.unchanged} tone="text-muted" />
            <Stat label="Ignorés" value={report.skipped} tone={report.skipped > 0 ? "text-danger" : ""} />
          </div>
          {report.unknown_columns.length > 0 && (
            <p className="mt-3 text-sm text-muted">Colonnes ignorées : <span className="font-medium text-ink">{report.unknown_columns.join(", ")}</span></p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Erreurs et avertissements ({errCount} erreur(s), {warnCount} avertissement(s))</h3>
            <div className="flex flex-wrap gap-2">
              {report.issues.length > 0 && <button type="button" className={btnGhost} onClick={exportIssues}>Exporter le rapport (CSV)</button>}
              {(report.rejected?.length ?? 0) > 0 && <button type="button" className={btnGhost} onClick={exportRejected}>Télécharger les lignes refusées</button>}
            </div>
          </div>

          {report.issues.length === 0 ? (
            <p className="mt-2 text-sm text-success">Aucun problème détecté.</p>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 border-b border-line bg-page text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">&nbsp;</th>
                    <th className="px-3 py-2 font-medium">Champ</th>
                    <th className="px-3 py-2 font-medium">Élément</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.issues.map((i, idx) => (
                    <tr key={idx}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">{i.row}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${i.level === "error" ? "bg-danger/10 text-danger" : "bg-accent/15 text-amber-700"}`}>
                          {i.level === "error" ? "Erreur" : "Avertissement"}
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
          {report.issues_truncated && <p className="mt-2 text-xs text-muted">Liste tronquée : corrigez les premières erreurs puis recommencez.</p>}

          {report.preview.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Détail des lignes lues ({report.preview.length} premières)</summary>
              <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-line">
                    {report.preview.map((p) => (
                      <tr key={p.row}>
                        <td className="whitespace-nowrap px-3 py-2 font-semibold">{p.row}</td>
                        <td className="px-3 py-2 text-muted">{ACTION[p.action] ?? p.action}</td>
                        <td className="px-3 py-2">{p.label}</td>
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