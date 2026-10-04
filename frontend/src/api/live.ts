import { apiClient } from "./client"

export interface LiveItem {
  course_id: number
  enrollment_id: number | null
  title: string
}

export const liveStatusApi = {
  status: () => apiClient.get<{ data: LiveItem[] }>("/live/status"),
}

export const liveAdminApi = {
  start: (courseId: number) => apiClient.post(`/admin/courses/${courseId}/live/start`),
  stop: (courseId: number) => apiClient.post(`/admin/courses/${courseId}/live/stop`),
  permit: (courseId: number, identity: string, allow: boolean) =>
    apiClient.post(`/admin/courses/${courseId}/live/permit`, { identity, allow }),
  kick: (courseId: number, identity: string) =>
    apiClient.post(`/admin/courses/${courseId}/live/kick`, { identity }),
}