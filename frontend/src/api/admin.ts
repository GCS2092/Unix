import { apiClient } from "./client"
import type { AdminOrder, ApiCollection, ApiResource, Product } from "../types"

export interface ProductPayload {
  name: string
  description: string | null
  price: number
  stock: number
  is_published: boolean
}

export const adminApi = {
  products: (page: number) =>
    apiClient.get<ApiCollection<Product>>("/admin/products", { params: { page } }),
  createProduct: (payload: ProductPayload) =>
    apiClient.post<ApiResource<Product>>("/admin/products", payload),
  updateProduct: (id: number, payload: Partial<ProductPayload>) =>
    apiClient.patch<ApiResource<Product>>(`/admin/products/${id}`, payload),
  deleteProduct: (id: number) => apiClient.delete(`/admin/products/${id}`),

  orders: (page: number) =>
    apiClient.get<ApiCollection<AdminOrder>>("/admin/orders", { params: { page } }),
  markPaid: (id: number) =>
    apiClient.post<ApiResource<AdminOrder>>(`/admin/orders/${id}/mark-paid`),
}