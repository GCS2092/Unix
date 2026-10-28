import { apiClient } from "./client"

export interface Address {
  id: number
  label: string | null
  recipient_name: string
  phone: string
  country?: string
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
  country: string
  city: string
  district: string
  address: string
  landmark: string
  is_default: boolean
}

export interface ProfileData {
  name: string
  email: string
  phone: string | null
  gender: string | null
  birth_date: string | null
  birth_place: string | null
  birth_country: string | null
  nationality: string | null
  country: string | null
  city: string | null
  address: string | null
  profession: string | null
  email_verified: boolean
}
export const accountApi = {
  me: () => apiClient.get<{ user: ProfileData }>("/auth/me"),
  updateProfile: (p: { name: string; phone: string } & Record<string, string | null | undefined>) =>
    apiClient.patch<{ user: ProfileData }>("/profile", p),
  updatePassword: (p: { current_password: string; password: string; password_confirmation: string }) =>
    apiClient.put<{ message: string }>("/profile/password", p),
  addresses: () => apiClient.get<{ data: Address[] }>("/addresses"),
  createAddress: (p: AddressInput) => apiClient.post<{ data: Address }>("/addresses", p),
  updateAddress: (id: number, p: AddressInput) => apiClient.patch<{ data: Address }>(`/addresses/${id}`, p),
  deleteAddress: (id: number) => apiClient.delete(`/addresses/${id}`),
}
export const DEFAULT_COUNTRY = "SN"
