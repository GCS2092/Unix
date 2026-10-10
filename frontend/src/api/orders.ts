import { apiClient } from "./client"
import type { AdminOrder, ApiResource, Order, PaymentRetryResponse } from "../types"

export interface TrackingPayload {
  carrier: string
  tracking_number: string
  pickup_note: string
  serial_numbers: string
  warranty_months: number | null
}

export const ordersApi = {
  list: () => apiClient.get<{ data: Order[] }>("/orders"),
  show: (id: number) => apiClient.get<ApiResource<Order>>(`/orders/${id}`),
  retryPayment: (id: number) =>
    apiClient.post<PaymentRetryResponse>(`/orders/${id}/retry-payment`),
  invoice: (id: number) =>
    apiClient.get<Blob>(`/orders/${id}/invoice`, { responseType: "blob" }),
  confirmReceived: (id: number) =>
    apiClient.post<ApiResource<Order>>(`/orders/${id}/confirm-received`),
  track: (token: string) =>
    apiClient.get<ApiResource<Order>>(`/track/${encodeURIComponent(token)}`),
  confirmTracked: (token: string) =>
    apiClient.post<ApiResource<Order>>(`/track/${encodeURIComponent(token)}/confirm-received`),
  adminShow: (id: number) =>
    apiClient.get<ApiResource<AdminOrder>>(`/admin/orders/${id}`),
  adminTracking: (id: number, payload: TrackingPayload) =>
    apiClient.patch<ApiResource<AdminOrder>>(`/admin/orders/${id}/tracking`, payload),
}