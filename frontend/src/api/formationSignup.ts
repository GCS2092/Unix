import { apiClient } from "./client"
import type { User } from "../types"

export const formationSignupApi = {
  signup: (p: {
    name: string
    email: string
    phone: string
    password: string
    password_confirmation: string
    course_id: number
    message?: string
    gender: string
    birth_date: string
    birth_place: string
    birth_country: string
    nationality: string
    country: string
    city: string
    address?: string
    profession?: string
  }) => apiClient.post<{ user: User; token: string; request_status: string }>("/auth/formation-signup", p),
}