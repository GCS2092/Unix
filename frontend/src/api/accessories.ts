import { apiClient } from "./client"
import type { Product } from "../types"

export interface AccessoryRow {
  id: number
  name: string
  slug: string
  price: number
  stock: number
  kind: "device" | "accessory" | "bundle"
  is_published: boolean
  is_required: boolean
}

export const accessoriesApi = {
  list: async (slug: string) =>
    (await apiClient.get<{ data: AccessoryRow[] }>(`/admin/products/${encodeURIComponent(slug)}/accessories`)).data.data,

  save: async (slug: string, rows: { id: number; is_required: boolean }[]) =>
    (await apiClient.put<{ data: AccessoryRow[] }>(`/admin/products/${encodeURIComponent(slug)}/accessories`, { accessories: rows })).data.data,

  search: async (q: string) =>
    (await apiClient.get<{ data: Product[] }>("/admin/products", { params: { q } })).data.data,
}