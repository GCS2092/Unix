import { apiClient } from "./client"
import type { AuthResponse, User } from "../types"

export const authApi = {
  register: (payload: { name: string; email: string; password: string; password_confirmation?: string }) =>
    apiClient.post<AuthResponse>("/auth/register", payload),

  login: (payload: { email: string; password: string; device_name?: string }) =>
    apiClient.post<AuthResponse>("/auth/login", payload),

  logout: () => apiClient.post<{ message: string }>("/auth/logout"),

  me: () => apiClient.get<{ user: User }>("/auth/me"),

  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>("/auth/forgot-password", { email }),

  resetPassword: (payload: { token: string; email: string; password: string; password_confirmation: string }) =>
    apiClient.post<{ message: string }>("/auth/reset-password", payload),
}
