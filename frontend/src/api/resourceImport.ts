import { apiClient } from "./client"
import type { AnalyzeColumn, ImportIssue } from "./productImport"
import { waitForRun } from "./importRuns"

export type ImportScope = "shop" | "formation"

export interface GenericAnalyzeResult {
  sheets: { index: number; name: string }[]
  sheet: number
  header_line: number
  total_rows: number
  max_rows: number
  columns: AnalyzeColumn[]
  fields: { key: string; label: string; identifies: boolean; required: boolean }[]
  warnings: string[]
}

export interface ResourceReport {
  dry_run: boolean
  total: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  unknown_columns: string[]
  issues: ImportIssue[]
  issues_truncated?: boolean
  preview: { row: number; action: string; label: string }[]
  rejected?: { row: number; reason: string; data: Record<string, string> }[]
  warnings?: string[]
  header_line?: number
}

export interface ResourceRunOptions {
  dryRun: boolean
  mode: "both" | "create" | "update"
  mapping: Record<number, string>
  sheet: number
  headerLine: number
  remember: boolean
}

const multipart = { "Content-Type": "multipart/form-data" }

export const resourceImportApi = {
  analyze: (scope: ImportScope, resource: string, file: File, sheet?: number, headerLine?: number) => {
    const form = new FormData()
    form.append("file", file)
    if (sheet !== undefined) form.append("sheet", String(sheet))
    if (headerLine !== undefined) form.append("header_line", String(headerLine))
    return apiClient.post<{ data: GenericAnalyzeResult }>(`/admin/import/${scope}/${resource}/analyze`, form, { timeout: 60_000, headers: multipart })
  },
  run: async (scope: ImportScope, resource: string, file: File, o: ResourceRunOptions) => {
    const form = new FormData()
    form.append("file", file)
    form.append("dry_run", o.dryRun ? "1" : "0")
    form.append("mode", o.mode)
    form.append("mapping", JSON.stringify(o.mapping))
    form.append("sheet", String(o.sheet))
    form.append("header_line", String(o.headerLine))
    form.append("remember", o.remember ? "1" : "0")
    form.append("async", "1")
    const res = await apiClient.post<{ data: { run_id: number } }>(`/admin/import/${scope}/${resource}`, form, { timeout: 120_000, headers: multipart })
    const report = await waitForRun<ResourceReport>(res.data.data.run_id)
    return { data: { data: report } }
  },
  template: (scope: ImportScope, resource: string) =>
    apiClient.get<Blob>(`/admin/import/${scope}/${resource}/template`, { responseType: "blob" }),
}