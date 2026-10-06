import { apiClient } from "./client"

export interface LiveSessionItem {
  id: number
  course_id: number
  course_title: string
  title: string | null
  starts_at: string
  note: string | null
}

export const sessionsApi = {
  mine: () => apiClient.get<{ data: LiveSessionItem[] }>("/live/sessions"),
  adminList: (courseId?: number) =>
    apiClient.get<{ data: LiveSessionItem[] }>("/admin/live-sessions", { params: courseId ? { course_id: courseId } : {} }),
  create: (body: { course_id: number; title?: string; starts_at: string; note?: string; notify: boolean }) =>
    apiClient.post<{ data: { id: number; notified: number } }>("/admin/live-sessions", body),
  remove: (id: number) => apiClient.delete(`/admin/live-sessions/${id}`),
}