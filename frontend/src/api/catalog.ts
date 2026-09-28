import { apiClient } from "./client"
import type { ApiCollection, ApiResource, Course, Product } from "../types"

export const catalogApi = {
  courses: () => apiClient.get<ApiCollection<Course>>("/catalog/courses"),
  course: (slug: string) => apiClient.get<ApiResource<Course>>(`/catalog/courses/${slug}`),
  products: () => apiClient.get<ApiCollection<Product>>("/catalog/products"),
  product: (slug: string) => apiClient.get<ApiResource<Product>>(`/catalog/products/${slug}`),
}
