import { apiClient } from "./client"
import type { AdminOrder, ApiCollection, ApiResource, Product } from "../types"

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

export interface DashboardData {
  kpis: {
    revenue_total: number; revenue_today: number; revenue_30d: number
    orders_today: number; orders_pending: number; orders_failed: number; orders_to_process: number
    products_total: number; users_total: number; courses_total: number; enrollments_total: number
  }
  sales: { date: string; total: number }[]
  top_products: { id: number; name: string; quantity: number; revenue: number }[]
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
  q?: string
}

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
  updateUser: (id: number, payload: { is_admin?: boolean; is_blocked?: boolean }) =>
    apiClient.patch<ApiResource<AdminUser>>(`/admin/users/${id}`, payload),

  dashboard: () => apiClient.get<ApiResource<DashboardData>>("/admin/dashboard"),

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
    apiClient.get<ApiCollection<AdminOrder>>("/admin/orders", {
      params: { page, status: filters.status || undefined, q: filters.q || undefined },
    }),
  order: (id: number) => apiClient.get<ApiResource<AdminOrder>>(`/admin/orders/${id}`),
  exportOrders: (filters: OrderFilters = {}) =>
    apiClient.get<Blob>("/admin/orders/export", {
      params: { status: filters.status || undefined, q: filters.q || undefined },
      responseType: "blob",
    }),
  markPaid: (id: number) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/mark-paid`),
  updateFulfillment: (id: number, status: string) =>
    apiClient.patch<ApiResource<AdminOrder>>(`/admin/orders/${id}/fulfillment`, { status }),

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