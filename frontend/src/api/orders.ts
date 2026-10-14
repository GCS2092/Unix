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
  trackInvoice: (token: string) =>
    apiClient.get<Blob>(`/track/${encodeURIComponent(token)}/invoice`, { responseType: "blob" }),
  confirmReceived: (id: number) =>
    apiClient.post<ApiResource<Order>>(`/orders/${id}/confirm-received`),
  communications: () => apiClient.get<ApiResource<PublicCommunications>>("/public/communications"),
  lookup: (ref: string, email: string) =>
    apiClient.post<ApiResource<{ token: string }>>("/track/lookup", { ref, email }),
  track: (token: string) =>
    apiClient.get<ApiResource<Order>>(`/track/${encodeURIComponent(token)}`),
  retryTracked: (token: string) =>
    apiClient.post<PaymentRetryResponse>(`/track/${encodeURIComponent(token)}/retry-payment`),
  declarePayment: (id: number, reference?: string) =>
    apiClient.post<ApiResource<Order>>(`/orders/${id}/declare-payment`, { reference: reference || undefined }),
  declareTracked: (token: string, reference?: string) =>
    apiClient.post<ApiResource<Order>>(`/track/${encodeURIComponent(token)}/declare-payment`, { reference: reference || undefined }),
  confirmTracked: (token: string) =>
    apiClient.post<ApiResource<Order>>(`/track/${encodeURIComponent(token)}/confirm-received`),
  adminResendConfirmation: (id: number) =>
    apiClient.post<{ data: { sent_to: string } }>(`/admin/orders/${id}/resend-confirmation`),
  adminShow: (id: number) =>
    apiClient.get<ApiResource<AdminOrder>>(`/admin/orders/${id}`),
  adminTracking: (id: number, payload: TrackingPayload) =>
    apiClient.patch<ApiResource<AdminOrder>>(`/admin/orders/${id}/tracking`, payload),
}

export interface PublicCommunications {
  shop_name: string
  support_email: string
  support_whatsapp: string
  announcement_fr: string
  announcement_en: string
}
