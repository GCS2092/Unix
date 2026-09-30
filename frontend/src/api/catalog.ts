import { apiClient } from "./client"
import type { ApiCollection, ApiResource, Product } from "../types"

export interface ProductQuery { page?: number; search?: string; sort?: string }

export const catalogApi = {
  products: (params: ProductQuery = {}) => apiClient.get<ApiCollection<Product>>("/catalog/products", { params }),
  product: (slug: string) => apiClient.get<ApiResource<Product>>(`/catalog/products/${slug}`),
}