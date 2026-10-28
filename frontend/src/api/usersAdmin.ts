import { apiClient } from "./client"

export const usersAdminApi = {
  updateProfile: (id: number, p: Record<string, string | null>) => apiClient.patch(`/admin/users/${id}/profile`, p),
  verifyEmail: (id: number) => apiClient.post(`/admin/users/${id}/verify-email`),
}