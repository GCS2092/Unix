import { apiClient } from "./client"

export const emailVerificationApi = {
  sendCode: () => apiClient.post<{ data: { sent?: boolean; verified?: boolean } }>("/auth/email/code"),
  confirmCode: (code: string) => apiClient.post<{ data: { verified: boolean; attached_orders: number } }>("/auth/email/confirm", { code }),
  confirmLink: (id: number, token: string) =>
    apiClient.post<{ data: { verified: boolean; attached_orders: number } }>("/auth/email/confirm-link", { id, token }),
}