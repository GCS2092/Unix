import axios from "axios"
import type { ApiResource } from "../types"

export interface ShippingInfo {
  pickup_fee: number
  zones: { key: string; fee: number }[]
}

export const shippingApi = {
  get: () => axios.get<ApiResource<ShippingInfo>>("/api/shipping"),
}