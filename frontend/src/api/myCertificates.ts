import { apiClient } from "./client"

export type MyCertStatus = "issued" | "revoked" | "ready" | "blocked" | "in_progress"

export interface MyCert {
  enrollment_id: number
  course_id: number
  course_title: string | null
  progress: number
  status: MyCertStatus
  certificate: {
    id: number
    code: string
    issued_at: string | null
    emailed_at: string | null
    verify_url: string
  } | null
}

export const myCertificatesApi = {
  list: () => apiClient.get<{ data: MyCert[] }>("/certificates"),
  view: (id: number) => apiClient.get<Blob>(`/certificates/${id}/view`, { responseType: "blob" }),
  download: (id: number) => apiClient.get<Blob>(`/certificates/${id}/download`, { responseType: "blob" }),
  obtain: (enrollmentId: number) => apiClient.post(`/enrollments/${enrollmentId}/certificate`),
}