import { apiClient } from "./client"
import type { RequestStatus } from "./enrollmentRequests"

export interface RequestRow {
  id: number
  status: RequestStatus
  message: string | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
  user_id: number | null
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  email_verified: boolean
  user_blocked: boolean
  course_id: number
  course_title: string | null
}

export interface RequestList {
  data: RequestRow[]
  counts: Record<RequestStatus, number>
  meta: { current_page: number; last_page: number; total: number }
}

export interface RequestDetail {
  id: number
  status: RequestStatus
  message: string | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
  decided_by_name: string | null
  course: { id: number; title: string | null }
  user: {
    id: number
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
    is_blocked: boolean
    is_student: boolean
    created_at: string | null
  } | null
  enrollment_id: number | null
  orders_count: number
  orders: { id: number; status: string | null; created_at: string | null }[]
  enrollments: { id: number; course_title: string | null; progress: number; completed: boolean }[]
  other_requests: { id: number; course_title: string | null; status: RequestStatus; created_at: string }[]
}

export const requestsAdminApi = {
  list: (params: { status: RequestStatus; course_id?: number; q?: string; page?: number }) =>
    apiClient.get<RequestList>("/admin/enrollment-requests/list", { params }),
  show: (id: number) => apiClient.get<{ data: RequestDetail }>(`/admin/enrollment-requests/${id}`),
  resendDecision: (id: number) =>
    apiClient.post<{ data: { id: number } }>(`/admin/enrollment-requests/${id}/resend-decision`),
  resendLink: (id: number, type: "verify" | "password") =>
    apiClient.post<{ data: { id: number } }>(`/admin/enrollment-requests/${id}/resend-link`, { type }),
  removeEnrollment: (enrollmentId: number) =>
    apiClient.delete<{ data: { id: number } }>(`/admin/enrollments/${enrollmentId}`),
}