import axios from "axios"
import type { ApiResource } from "../types"

export interface ShippingInfo {
  pickup_fee: number
  free_shipping_threshold?: number
  min_order?: number
  zones: { key: string; fee: number; label_fr?: string; label_en?: string }[]
}

export interface PublicShop {
  shop_name: string
  support_email: string
  support_whatsapp: string
  pickup_place: string
  pickup_hours: string
  pickup_requirements: string
  legal_name: string
  legal_address: string
  legal_phone: string
  legal_email: string
  opening_hours: string
  social_facebook: string
  social_instagram: string
  social_tiktok: string
  terms_url: string
  free_shipping_threshold: number
  min_order: number
}

export const shippingApi = {
  get: (country?: string) => axios.get<ApiResource<ShippingInfo>>("/api/shipping", { params: { country } }),
  publicShop: () => axios.get<ApiResource<PublicShop>>("/api/v1/public/shop"),
}