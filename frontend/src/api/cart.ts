import { apiClient, ensureCsrfCookie } from "./client"
import type { ApiResource, Cart } from "../types"

export const cartApi = {
  show: () => apiClient.get<ApiResource<Cart>>("/cart"),

  add: async (payload: { type: "course" | "product"; id: number; quantity?: number }) => {
    await ensureCsrfCookie()
    return apiClient.post<ApiResource<Cart>>("/cart/items", payload)
  },

  update: async (type: string, id: number, payload: { quantity: number }) => {
    await ensureCsrfCookie()
    return apiClient.patch<ApiResource<Cart>>(`/cart/items/${type}/${id}`, payload)
  },

  remove: async (type: string, id: number) => {
    await ensureCsrfCookie()
    return apiClient.delete<ApiResource<Cart>>(`/cart/items/${type}/${id}`)
  },
}
