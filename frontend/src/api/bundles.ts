import { apiClient } from "./client"
import type { Product } from "../types"

export interface BundleRow {
  id: number
  name: string
  slug: string
  price: number
  stock: number
  kind: "device" | "accessory" | "bundle"
  is_published: boolean
  quantity: number
}

export interface BundleData {
  components: BundleRow[]
  pack_stock: number
}

export const bundlesApi = {
  list: async (slug: string) =>
    (await apiClient.get<{ data: BundleData }>(`/admin/products/${encodeURIComponent(slug)}/components`)).data.data,

  save: async (slug: string, rows: { id: number; quantity: number }[]) =>
    (await apiClient.put<{ data: BundleData }>(`/admin/products/${encodeURIComponent(slug)}/components`, { components: rows })).data.data,

  search: async (q: string) =>
    (await apiClient.get<{ data: Product[] }>("/admin/products", { params: { q } })).data.data,
}