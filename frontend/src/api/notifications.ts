import { apiClient } from "./client"

export interface AppNotification {
  id: string
  read_at: string | null
  created_at: string
  data: {
    type: string
    course_id: number
    course_title: string
    path: string
    guest: boolean
    note: string | null
    invited_by: string | null
  }
}

export const notificationsApi = {
  list: () => apiClient.get<{ data: AppNotification[]; unread_count: number }>("/notifications"),
  read: (id: string) => apiClient.post(`/notifications/${id}/read`),
  readAll: () => apiClient.post("/notifications/read-all"),
}