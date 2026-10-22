import { apiClient } from "./client"

export type CertStatus = "ready" | "blocked" | "issued" | "in_progress"

export interface CertRow {
  id: number
  user_name: string | null
  user_email: string | null
  course_id: number
  course_title: string | null
  progress: number
  completed: boolean
  exam_required: boolean
  exam_passed: boolean
  status: CertStatus
  certificate_id: number | null
  certificate_issued_at: string | null
  completed_at: string | null
}

export interface CertIdentity {
  name: string
  email: string
  birth_date: string | null
  birth_place: string | null
  birth_country: string | null
  course_title: string | null
  has_certificate: boolean
}

export interface CertList {
  data: CertRow[]
  counts: Record<CertStatus, number>
  meta: { current_page: number; last_page: number; total: number }
}

export interface StudentCerts {
  id: number
  name: string
  email: string
  email_verified: boolean
  blocked: boolean
  enrollments: CertRow[]
}

export interface StudentList {
  data: StudentCerts[]
  meta: { current_page: number; last_page: number; total: number }
}

export interface BatchResult {
  issued: number
  failed: number
  skipped: number
  results: { id: number; status: "issued" | "failed" | "skipped"; message?: string }[]
}

export interface SendResult {
  sent: number
  failed: number
  skipped: number
  results: { id: number; status: "sent" | "failed" | "skipped"; message?: string }[]
}

export const certificatesAdminApi = {
  list: (params: { status: CertStatus; course_id?: number; q?: string; page?: number }) =>
    apiClient.get<CertList>("/admin/certificates", { params }),
  students: (params: { course_id?: number; q?: string; page?: number }) =>
    apiClient.get<StudentList>("/admin/certificates/students", { params }),
  readyIds: (params: { course_id?: number; q?: string }) =>
    apiClient.get<{ data: number[]; total: number }>("/admin/certificates/ready-ids", { params }),
  issueBatch: (ids: number[]) =>
    apiClient.post<{ data: BatchResult }>("/admin/certificates/issue-batch", { ids }),
  send: (ids: number[]) =>
    apiClient.post<{ data: SendResult }>("/admin/certificates/send", { ids }),
  identity: (enrollmentId: number) =>
    apiClient.get<{ data: CertIdentity }>(`/admin/certificates/${enrollmentId}/identity`),
  correct: (enrollmentId: number, p: Omit<CertIdentity, "email" | "course_title" | "has_certificate">) =>
    apiClient.patch<{ data: { regenerated: boolean } }>(`/admin/certificates/${enrollmentId}/correct`, p),
  emailed: (ids: number[]) =>
    apiClient.get<{ data: Record<string, string> }>("/admin/certificates/emailed", { params: { ids } }),
  grantAttempt: (enrollmentId: number) =>
    apiClient.post(`/admin/enrollments/${enrollmentId}/quiz/grant-attempt`),
  files: (ids: number[]) =>
    apiClient.post<Blob>("/admin/certificates/files", { ids }, { responseType: "blob" }),
}