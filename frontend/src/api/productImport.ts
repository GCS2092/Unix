import { apiClient } from "./client"
import { waitForRun } from "./importRuns"

export interface ImportIssue {
  row: number
  level: "error" | "warning"
  field: string | null
  message: string
  name: string
}

export interface ImportPreviewRow {
  row: number
  action: "create" | "update" | "unchanged"
  name: string
  price: number | null
  stock: number
}

export interface ImportReport {
  dry_run: boolean
  total: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  unknown_columns: string[]
  issues: ImportIssue[]
  issues_truncated?: boolean
  preview: ImportPreviewRow[]
  rejected?: { row: number; reason: string; data: Record<string, string> }[]
  warnings?: string[]
  header_line?: number
}

export type Confidence = "saved" | "high" | "medium" | "low" | "none"

export interface AnalyzeColumn {
  index: number
  header: string
  samples: string[]
  field: string | null
  confidence: Confidence
  note: string | null
}

export interface AnalyzeResult {
  sheets: { index: number; name: string }[]
  sheet: number
  header_line: number
  total_rows: number
  max_rows: number
  columns: AnalyzeColumn[]
  fields: { key: string; label: string }[]
  warnings: string[]
}

export interface RunOptions {
  dryRun: boolean
  publish: boolean
  mode?: string
  keepStock?: boolean
  createCategories?: boolean
  mapping?: Record<number, string>
  sheet?: number
  headerLine?: number
  remember?: boolean
}

export const productImportApi = {
  analyze: (file: File, sheet?: number, headerLine?: number) => {
    const form = new FormData()
    form.append("file", file)
    if (sheet !== undefined) form.append("sheet", String(sheet))
    if (headerLine !== undefined) form.append("header_line", String(headerLine))
    return apiClient.post<{ data: AnalyzeResult }>("/admin/product-import/analyze", form, {
      timeout: 60_000,
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  run: async (file: File, opts: RunOptions) => {
    const form = new FormData()
    form.append("file", file)
    form.append("dry_run", opts.dryRun ? "1" : "0")
    form.append("publish", opts.publish ? "1" : "0")
    form.append("mode", opts.mode ?? "both")
    form.append("keep_stock", opts.keepStock ? "1" : "0")
    form.append("create_categories", opts.createCategories ? "1" : "0")
    if (opts.mapping) form.append("mapping", JSON.stringify(opts.mapping))
    if (opts.sheet !== undefined) form.append("sheet", String(opts.sheet))
    if (opts.headerLine !== undefined) form.append("header_line", String(opts.headerLine))
    form.append("remember", opts.remember ? "1" : "0")
    form.append("async", "1")
    const res = await apiClient.post<{ data: { run_id: number } }>("/admin/product-import", form, {
      timeout: 120_000,
      headers: { "Content-Type": "multipart/form-data" },
    })
    const report = await waitForRun<ImportReport>(res.data.data.run_id)
    return { data: { data: report } }
  },
  template: () => apiClient.get<Blob>("/admin/product-import/template", { responseType: "blob" }),
}