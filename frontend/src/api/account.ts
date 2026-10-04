import { apiClient } from "./client"

export interface Address {
  id: number
  label: string | null
  recipient_name: string
  phone: string
  city: string
  district: string | null
  address: string
  landmark: string | null
  is_default: boolean
}

export interface AddressInput {
  label: string
  recipient_name: string
  phone: string
  city: string
  district: string
  address: string
  landmark: string
  is_default: boolean
}

export const accountApi = {
  me: () => apiClient.get<{ user: { name: string; email: string; phone: string | null } }>("/auth/me"),
  updateProfile: (p: { name: string; phone: string }) =>
    apiClient.patch<{ user: { name: string; phone: string | null } }>("/profile", p),
  updatePassword: (p: { current_password: string; password: string; password_confirmation: string }) =>
    apiClient.put<{ message: string }>("/profile/password", p),
  addresses: () => apiClient.get<{ data: Address[] }>("/addresses"),
  createAddress: (p: AddressInput) => apiClient.post<{ data: Address }>("/addresses", p),
  updateAddress: (id: number, p: AddressInput) => apiClient.patch<{ data: Address }>(`/addresses/${id}`, p),
  deleteAddress: (id: number) => apiClient.delete(`/addresses/${id}`),
}