import { apiClient } from "./client"
import type { AdminOrder, ApiResource, Product } from "../types"

export const SOURCES = ["whatsapp", "phone", "shop", "other"] as const
export const PAYMENT_METHODS = ["cash", "wave", "orange_money", "free_money", "card", "transfer", "other"] as const

export interface ManualOrderPayload {
  guest_name?: string
  guest_email?: string
  phone: string
  items: { product_id: number; quantity: number; unit_price?: number }[]
  delivery_method: "delivery" | "pickup"
  delivery_zone?: string
  delivery_fee?: number
  city?: string
  district?: string
  address?: string
  landmark?: string
  note?: string
  source: string
  payment_method?: string
  paid: boolean
}

export interface TimelineEntry {
  type: "created" | "step" | "note" | "action"
  id?: number
  label: string
  author?: string | null
  user_id?: number | null
  meta?: Record<string, unknown> | null
  at: string | null
}

export interface CustomerRow {
  key: string
  name: string | null
  email: string | null
  phone: string | null
  user_id: number | null
  orders_count: number
  paid_count: number
  spent: number
  avg_basket: number
  last_order_at: string | null
}

export interface CustomerNote { id: number; body: string; author: string | null; user_id: number | null; created_at: string | null }

export interface CustomerDetail extends CustomerRow {
  account: { id: number; is_blocked: boolean; is_student: boolean; created_at: string | null } | null
  addresses: { id: number; label: string | null; recipient_name: string; phone: string; city: string; district: string | null; address: string; landmark: string | null; is_default: boolean }[]
  orders: { id: number; public_ref: string | null; status: string; fulfillment_status: string | null; total: number; currency: string; source: string | null; items_count: number; created_at: string | null }[]
  notes: CustomerNote[]
}

export interface CustomerQuery { q?: string; sort?: string }

export const shopApi = {
  searchProducts: (q: string) =>
    apiClient.get<{ data: Product[] }>("/admin/products", { params: { q: q || undefined } }),
  createManualOrder: (p: ManualOrderPayload) => apiClient.post<ApiResource<AdminOrder>>("/admin/orders/manual", p),
  timeline: (orderId: number) => apiClient.get<{ data: TimelineEntry[] }>(`/admin/orders/${orderId}/timeline`),
  addOrderNote: (orderId: number, body: string) => apiClient.post<{ data: TimelineEntry }>(`/admin/orders/${orderId}/notes`, { body }),
  deleteOrderNote: (orderId: number, noteId: number) => apiClient.delete(`/admin/orders/${orderId}/notes/${noteId}`),
  customers: (page: number, f: CustomerQuery = {}) =>
    apiClient.get<{ data: CustomerRow[]; meta: { current_page: number; last_page: number; total: number } }>("/admin/customers", {
      params: { page, q: f.q || undefined, sort: f.sort || undefined },
    }),
  customer: (key: string) => apiClient.get<{ data: CustomerDetail }>("/admin/customers/detail", { params: { key } }),
  addCustomerNote: (key: string, body: string) => apiClient.post<{ data: CustomerNote }>("/admin/customers/notes", { key, body }),
  deleteCustomerNote: (id: number) => apiClient.delete(`/admin/customers/notes/${id}`),
  exportCustomers: (f: CustomerQuery = {}) =>
    apiClient.get<Blob>("/admin/customers/export", { params: { q: f.q || undefined, sort: f.sort || undefined }, responseType: "blob" }),
}