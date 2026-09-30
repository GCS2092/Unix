import { apiClient } from "./client"
import type { ApiCollection, ApiResource, Product } from "../types"

export const catalogApi = {
  products: () => apiClient.get<ApiCollection<Product>>("/catalog/products"),
  product: (slug: string) => apiClient.get<ApiResource<Product>>(`/catalog/products/${slug}`),
}