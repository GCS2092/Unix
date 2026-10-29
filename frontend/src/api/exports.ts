import { isAxiosError } from "axios"
import { apiClient } from "./client"
import { saveBlob } from "../lib/download"

export type ExportFormat = "xlsx" | "csv" | "json"

/** Espace admin de chaque ressource (doit refléter ExportRegistry côté PHP). */
const SCOPE: Record<string, "shop" | "formation"> = {
  products: "shop",
  categories: "shop",
  orders: "shop",
  "order-lines": "shop",
  courses: "formation",
  "shipping-zones": "shop",
  "faqs-shop": "shop",
  "faqs-formation": "formation",
}

export async function downloadExport(resource: string, format: ExportFormat, params: Record<string, string> = {}): Promise<void> {
  const scope = SCOPE[resource]
  if (!scope) throw new Error(`Ressource d'export inconnue : ${resource}`)
  const res = await apiClient.get<Blob>(`/admin/export/${scope}/${resource}`, {
    params: { format, ...params },
    responseType: "blob",
    timeout: 300_000,
  })
  saveBlob(res.data, `${resource}-${new Date().toISOString().slice(0, 10)}.${format}`)
}

/** Les erreurs arrivent en Blob (responseType blob) : on relit le JSON. */
export async function exportErrorMessage(e: unknown): Promise<string> {
  if (!isAxiosError(e)) return "Une erreur est survenue."
  if (!e.response) return "Le serveur ne répond pas. Vérifiez votre connexion."
  let data: unknown = e.response.data
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()) } catch { data = undefined }
  }
  const d = data as { message?: string; errors?: Record<string, string[]> } | undefined
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  if (first ?? d?.message) return (first ?? d?.message) as string
  return e.response.status === 429 ? "Trop de tentatives. Patientez un instant." : "Une erreur est survenue."
}