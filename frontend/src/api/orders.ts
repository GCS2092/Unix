import { apiClient } from "./client"
import type { ApiResource, Order, PaymentRetryResponse } from "../types"

export const ordersApi = {
  list: () => apiClient.get<{ data: Order[] }>("/orders"),
  show: (id: number) => apiClient.get<ApiResource<Order>>(`/orders/${id}`),
  retryPayment: (id: number) =>
    apiClient.post<PaymentRetryResponse>(`/orders/${id}/retry-payment`),
  invoice: (id: number) =>
    apiClient.get<Blob>(`/orders/${id}/invoice`, { responseType: "blob" }),
}