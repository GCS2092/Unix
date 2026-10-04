import { apiClient } from "./client"
import type { AdminOrder, ApiCollection, ApiResource, PaginationMeta, Product } from "../types"

export interface ProductPayload {
  name: string
  description: string | null
  name_en?: string | null
  description_en?: string | null
  image_link?: string | null
  price: number
  stock: number
  is_published: boolean
}

export type DashboardRange = "7d" | "30d" | "90d" | "12m" | "custom"

export interface DashboardParams {
  range?: DashboardRange
  from?: string // YYYY-MM-DD (range = custom)
  to?: string
}

export interface DashboardMetric {
  value: number
  previous: number
  change: number | null // % vs période précédente, null = pas de base de comparaison
}

export interface DashboardData {
  period: {
    from: string
    to: string
    days: number
    granularity: "day" | "month"
    previous_from: string
    previous_to: string
  }
  metrics: {
    revenue: DashboardMetric
    paid_orders: DashboardMetric
    avg_basket: DashboardMetric
    orders_created: DashboardMetric
    payment_rate: DashboardMetric
    new_customers: DashboardMetric
  }
  snapshot: {
    revenue_total: number
    orders_to_process: number
    orders_pending: number
    orders_failed: number
    low_stock_count: number
    products_total: number
    users_total: number
  }
  series: { date: string; revenue: number; orders: number }[]
  statuses: { status: string; count: number }[]
  sales_by_type: { type: "product" | "course" | "other"; revenue: number; quantity: number }[]
  deliveries: { method: string; orders: number; revenue: number }[]
  top_cities: { city: string; orders: number; revenue: number }[]
  top_products: { id: number; name: string; quantity: number; revenue: number }[]
  top_customers: { name: string; email: string | null; orders: number; revenue: number }[]
  to_process: {
    id: number
    customer: string
    total: number
    currency: string
    delivery_method: string | null
    fulfillment_status: string | null
    paid_at: string | null
  }[]
  failed_orders: { id: number; customer: string; total: number; currency: string; created_at: string }[]
  low_stock: { id: number; name: string; stock: number }[]
  recent_orders: { id: number; customer: string; total: number; currency: string; status: string; created_at: string }[]
}

export interface AdminCourse {
  id: number
  title: string
  slug: string
  description: string | null
  price: number
  stream_video_id?: string | null
  livekit_room?: string | null
  is_published?: boolean
}

export interface CoursePayload {
  title: string
  description: string | null
  price: number
  stream_video_id: string | null
  livekit_room: string | null
  is_published: boolean
}

export interface AdminUser {
  id: number
  name: string
  email: string
  is_admin: boolean
  is_student: boolean
  is_blocked?: boolean
  created_at: string
  orders_count?: number
  enrollments_count?: number
}

export interface AdminEnrollment {
  id: number
  user_name: string | null
  user_email: string | null
  course_title: string | null
  progress: number
  completed: boolean
  completed_at: string | null
  certificate_id: number | null
  certificate_issued_at: string | null
  created_at: string
}

export interface AdminActivityLog {
  id: number
  action: string
  user_name: string | null
  user_email: string | null
  subject_type: string | null
  subject_id: number | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AdminSettings {
  pickup_fee: number
  dakar_fee: number
  regions_fee: number
  low_stock_threshold: number
}

export interface OrderFilters {
  status?: string
  quick?: string // "to_process" | "today"
  q?: string
}

export interface OrderCounts {
  all: number
  paid: number
  pending: number
  failed: number
  cancelled: number
  to_process: number
  today: number
  stock_conflict?: number
}

export interface OrderListResponse {
  data: AdminOrder[]
  meta: PaginationMeta & { counts?: OrderCounts }
}

export type StockReason = "restock" | "damage" | "inventory" | "adjustment"
export type StockFilter = "" | "low" | "out" | "reserved" | "unpublished"
export type StockSort = "stock_asc" | "stock_desc" | "name" | "recent"

export interface StockMeta { current_page: number; last_page: number; total: number }

export interface StockRow {
  id: number
  name: string
  slug: string
  image_url: string | null
  price: number
  stock: number
  reserved: number
  value: number
  status: "ok" | "low" | "out"
  is_published: boolean
}

export interface StockSummary {
  products_total: number
  units: number
  value: number
  out_count: number
  low_count: number
  published_out: number
  reserved_units: number
  conflicts: number
  low_stock_threshold: number
}

export interface StockOverviewResponse { data: StockRow[]; summary: StockSummary; meta: StockMeta }

export interface StockJournalEntry {
  id: number
  reason: string
  quantity_change: number
  stock_after: number
  note: string | null
  admin: string | null
  order_id: number | null
  product: { id: number; name: string; slug: string } | null
  created_at: string
}

export interface StockQuery { q?: string; filter?: StockFilter; sort?: StockSort }
export interface JournalQuery { reason?: string; product_id?: number; from?: string; to?: string }

export type InvoiceStatus = "issued" | "cancelled"

export interface InvoiceRow {
  id: number
  number: string
  status: InvoiceStatus
  issued_at: string | null
  customer_name: string | null
  customer_email: string | null
  order_id: number
  currency: string
  total: number
  filename: string
}

export interface InvoiceSummary {
  count: number
  issued_count: number
  cancelled_count: number
  issued_total: number
  zip_limit: number
}

export interface InvoiceListResponse {
  data: InvoiceRow[]
  summary: InvoiceSummary
  meta: { current_page: number; last_page: number; total: number }
}

export interface InvoiceQuery { q?: string; status?: "" | InvoiceStatus; from?: string; to?: string }

export const adminApi = {
  courses: (page: number) =>
    apiClient.get<ApiCollection<AdminCourse>>("/admin/courses", { params: { page } }),
  createCourse: (payload: CoursePayload) =>
    apiClient.post<ApiResource<AdminCourse>>("/admin/courses", payload),
  updateCourse: (slug: string, payload: Partial<CoursePayload>) =>
    apiClient.patch<ApiResource<AdminCourse>>(`/admin/courses/${encodeURIComponent(slug)}`, payload),
  deleteCourse: (slug: string) => apiClient.delete(`/admin/courses/${encodeURIComponent(slug)}`),

  users: (page: number, q: string) =>
    apiClient.get<ApiCollection<AdminUser>>("/admin/users", { params: { page, q: q || undefined } }),
  updateUser: (id: number, payload: { is_admin?: boolean; is_blocked?: boolean; is_student?: boolean }) =>
    apiClient.patch<ApiResource<AdminUser>>(`/admin/users/${id}`, payload),

  badges: () =>
    apiClient.get<ApiResource<{ orders_to_process: number; orders_pending: number }>>("/admin/dashboard/badges"),

  dashboard: (params: DashboardParams = {}) =>
    apiClient.get<ApiResource<DashboardData>>("/admin/dashboard", { params }),

  products: (page: number) =>
    apiClient.get<ApiCollection<Product>>("/admin/products", { params: { page } }),
  createProduct: (payload: ProductPayload) =>
    apiClient.post<ApiResource<Product>>("/admin/products", payload),
  updateProduct: (slug: string, payload: Partial<ProductPayload>) =>
    apiClient.patch<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}`, payload),
  deleteProduct: (slug: string) => apiClient.delete(`/admin/products/${encodeURIComponent(slug)}`),

  uploadImage: (slug: string, file: File) => {
    const form = new FormData()
    form.append("image", file)
    return apiClient.post<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  removeImage: (slug: string) =>
    apiClient.delete<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}/image`),

  addGalleryImage: (slug: string, file: File) => {
    const form = new FormData()
    form.append("image", file)
    return apiClient.post<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}/images`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  removeGalleryImage: (slug: string, imageId: number) =>
    apiClient.delete<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}/images/${imageId}`),

  orders: (page: number, filters: OrderFilters = {}) =>
    apiClient.get<OrderListResponse>("/admin/orders", {
      params: { page, status: filters.status || undefined, quick: filters.quick || undefined, q: filters.q || undefined },
    }),
  order: (id: number) => apiClient.get<ApiResource<AdminOrder>>(`/admin/orders/${id}`),
  exportOrders: (filters: OrderFilters = {}) =>
    apiClient.get<Blob>("/admin/orders/export", {
      params: { status: filters.status || undefined, quick: filters.quick || undefined, q: filters.q || undefined },
      responseType: "blob",
    }),
  markPaid: (id: number) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/mark-paid`),
  cancelOrder: (id: number, reason?: string) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/cancel`, { reason }),
  bulkAdvance: (ids: number[]) =>
    apiClient.post<ApiResource<{ updated: number; skipped: number }>>("/admin/orders/bulk-advance", { ids }),
  resolveStockConflict: (id: number) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/resolve-stock-conflict`),
  updateFulfillment: (id: number, status: string) =>
    apiClient.patch<ApiResource<AdminOrder>>(`/admin/orders/${id}/fulfillment`, { status }),

  stockOverview: (page: number, f: StockQuery = {}) =>
    apiClient.get<StockOverviewResponse>("/admin/stock", {
      params: { page, q: f.q || undefined, filter: f.filter || undefined, sort: f.sort || undefined },
    }),
  stockJournal: (page: number, f: JournalQuery = {}) =>
    apiClient.get<{ data: StockJournalEntry[]; meta: StockMeta }>("/admin/stock/movements", {
      params: { page, reason: f.reason || undefined, product_id: f.product_id || undefined, from: f.from || undefined, to: f.to || undefined },
    }),
  exportStock: (f: StockQuery = {}) =>
    apiClient.get<Blob>("/admin/stock/export", {
      params: { q: f.q || undefined, filter: f.filter || undefined, sort: f.sort || undefined },
      responseType: "blob",
    }),
  adjustStock: (slug: string, payload: { reason: StockReason; quantity: number; note?: string }) =>
    apiClient.post<ApiResource<Product>>(`/admin/products/${encodeURIComponent(slug)}/stock`, payload),

  invoices: (page: number, f: InvoiceQuery = {}) =>
    apiClient.get<InvoiceListResponse>("/admin/invoices", {
      params: { page, q: f.q || undefined, status: f.status || undefined, from: f.from || undefined, to: f.to || undefined },
    }),
  invoicePdf: (id: number) =>
    apiClient.get<Blob>(`/admin/invoices/${id}/pdf`, { responseType: "blob" }),
  invoicesZip: (payload: { ids?: number[] } & InvoiceQuery) =>
    apiClient.post<Blob>("/admin/invoices/zip", {
      ids: payload.ids && payload.ids.length > 0 ? payload.ids : undefined,
      q: payload.q || undefined,
      status: payload.status || undefined,
      from: payload.from || undefined,
      to: payload.to || undefined,
    }, { responseType: "blob" }),

  enrollments: (page: number, q: string, status: string) =>
    apiClient.get<ApiCollection<AdminEnrollment>>("/admin/enrollments", {
      params: { page, q: q || undefined, status: status || undefined },
    }),
  reissueCertificate: (enrollmentId: number) =>
    apiClient.post<ApiResource<AdminEnrollment>>(`/admin/enrollments/${enrollmentId}/certificate`),
  downloadCertificate: (certificateId: number) =>
    apiClient.get<Blob>(`/certificates/${certificateId}/download`, { responseType: "blob" }),

  activityLogs: (page: number, q: string) =>
    apiClient.get<ApiCollection<AdminActivityLog>>("/admin/activity-logs", { params: { page, q: q || undefined } }),

  settings: () => apiClient.get<ApiResource<AdminSettings>>("/admin/settings"),
  updateSettings: (payload: AdminSettings) =>
    apiClient.put<ApiResource<AdminSettings>>("/admin/settings", payload),
}