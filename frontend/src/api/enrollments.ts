import { apiClient } from "./client"
import type { ApiResource, Certificate, CoursePlayback, Enrollment } from "../types"

export const enrollmentsApi = {
  list: () => apiClient.get<{ data: Enrollment[] }>("/enrollments"),
  show: (id: number) => apiClient.get<ApiResource<Enrollment>>(`/enrollments/${id}`),
  updateProgress: (id: number, progress: number) =>
    apiClient.patch<ApiResource<Enrollment>>(`/enrollments/${id}/progress`, { progress }),
  complete: (id: number) => apiClient.post<ApiResource<Enrollment>>(`/enrollments/${id}/complete`),
  issueCertificate: (id: number) =>
    apiClient.post<ApiResource<Certificate>>(`/enrollments/${id}/certificate`),
  playback: (courseId: number) =>
    apiClient.get<ApiResource<CoursePlayback>>(`/courses/${courseId}/playback`),
}

export async function downloadCertificate(id: number): Promise<void> {
  const res = await apiClient.get<Blob>(`/certificates/${id}/download`, { responseType: "blob" })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement("a")
  a.href = url
  a.download = `certificat-${id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
