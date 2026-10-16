import { apiClient } from "./client"

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
}

export const productImportApi = {
  run: (file: File, opts: { dryRun: boolean; publish: boolean }) => {
    const form = new FormData()
    form.append("file", file)
    form.append("dry_run", opts.dryRun ? "1" : "0")
    form.append("publish", opts.publish ? "1" : "0")
    return apiClient.post<{ data: ImportReport }>("/admin/product-import", form, {
      timeout: 120_000,
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  template: () => apiClient.get<Blob>("/admin/product-import/template", { responseType: "blob" }),
}