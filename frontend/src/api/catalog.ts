import { apiClient } from "./client"
import type { ApiCollection, ApiResource, Product } from "../types"

export interface ProductQuery { page?: number; search?: string; sort?: string; category?: string; min_price?: number; max_price?: number; in_stock?: 1; new?: 1 }
export interface CategoryInfo { id: number; name: string; slug: string; products_count: number }

export const catalogApi = {
  products: (params: ProductQuery = {}) => apiClient.get<ApiCollection<Product>>("/catalog/products", { params }),
  product: (slug: string) => apiClient.get<ApiResource<Product>>(`/catalog/products/${slug}`),
  categories: () => apiClient.get<ApiResource<CategoryInfo[]>>("/catalog/categories"),
}