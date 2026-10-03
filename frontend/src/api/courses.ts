import { apiClient } from "./client"
import type { ApiCollection, ApiResource } from "../types"

export interface Course {
  id: number
  title: string
  slug: string
  description?: string | null
}

export interface Certificate {
  id: number
  issued_at?: string | null
}

export interface Enrollment {
  id: number
  progress: number
  completed_at: string | null
  course?: Course
  certificate?: Certificate | null
}

export const coursesApi = {
  catalog: () => apiClient.get<ApiCollection<Course>>("/catalog/courses"),
  mine: () => apiClient.get<{ data: Enrollment[] }>("/enrollments"),
  show: (id: number) => apiClient.get<ApiResource<Enrollment>>(`/enrollments/${id}`),
  playback: (slug: string) =>
    apiClient.get<{ data: { course_id: number; playback: unknown } }>(`/courses/${slug}/playback`),
  progress: (id: number, progress: number) =>
    apiClient.patch<ApiResource<Enrollment>>(`/enrollments/${id}/progress`, { progress }),
  issueCertificate: (id: number) => apiClient.post(`/enrollments/${id}/certificate`),
  certificate: (id: number) =>
    apiClient.get<Blob>(`/certificates/${id}/download`, { responseType: "blob" }),
}

export async function downloadCertificate(id: number): Promise<void> {
  const res = await coursesApi.certificate(id)
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `certificat-${id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}