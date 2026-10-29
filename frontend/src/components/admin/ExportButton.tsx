import { useState } from "react"
import Button from "../Button"
import { downloadExport, exportErrorMessage } from "../../api/exports"
import type { ExportFormat } from "../../api/exports"

interface Props {
  resource: string
  params?: Record<string, string>
  label?: string
}

export default function ExportButton({ resource, params, label = "Exporter" }: Props) {
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function go() {
    setBusy(true)
    setError("")
    try {
      await downloadExport(resource, format, params)
    } catch (e) {
      setError(await exportErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Format d'export"
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        className="min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      >
        <option value="xlsx">Excel (.xlsx)</option>
        <option value="csv">CSV (.csv)</option>
        <option value="json">JSON (.json)</option>
      </select>
      <Button variant="secondary" loading={busy} onClick={() => void go()}>{label}</Button>
      {error && <p role="alert" className="w-full rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  )
}