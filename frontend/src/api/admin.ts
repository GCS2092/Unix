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

export const adminApi = {
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

  orders: (page: number) =>
    apiClient.get<ApiCollection<AdminOrder>>("/admin/orders", { params: { page } }),
  markPaid: (id: number) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/mark-paid`),
}