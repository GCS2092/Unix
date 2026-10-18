import { apiClient } from "./client"

export type RequestStatus = "pending" | "approved" | "rejected"

export interface MyRequest {
  id: number
  course_id: number
  status: RequestStatus
  created_at: string
}

export interface AdminRequest {
  id: number
  status: RequestStatus
  message: string | null
  created_at: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  course_id: number
  course_title: string | null
}

export interface PickUser {
  id: number
  name: string
  email: string
  is_student: boolean
}

export const enrollmentRequestsApi = {
  mine: () => apiClient.get<{ data: MyRequest[] }>("/enrollment-requests"),
  create: (course_id: number, message?: string) =>
    apiClient.post<{ data: MyRequest }>("/enrollment-requests", { course_id, message }),
  adminList: (status: RequestStatus | "all" = "pending") =>
    apiClient.get<{ data: AdminRequest[] }>("/admin/enrollment-requests", { params: { status } }),
  decide: (id: number, action: "approve" | "reject") =>
    apiClient.post<{ data: { id: number; status: RequestStatus } }>(`/admin/enrollment-requests/${id}/decide`, { action }),
  searchUsers: (q: string) =>
    apiClient.get<{ data: PickUser[] }>("/admin/formations/users", { params: { q } }),
}
