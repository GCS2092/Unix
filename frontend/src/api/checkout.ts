import { apiClient, ensureCsrfCookie } from "./client"
import type { CheckoutResponse } from "../types"

export interface CheckoutPayload {
  guest_email?: string
  guest_name?: string
  phone?: string
  delivery_method?: "delivery" | "pickup"
  delivery_zone?: string
  city?: string
  district?: string
  address?: string
  landmark?: string
  note?: string
  accept_terms?: boolean
}

export const checkoutApi = {
  start: async (payload: CheckoutPayload) => {
    await ensureCsrfCookie()
    return apiClient.post<CheckoutResponse>("/checkout", payload)
  },
}