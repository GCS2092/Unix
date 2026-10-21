import { apiClient } from "./client"
import type { Course } from "./courses"
import type { ApiResource } from "../types"

export const courseCoverApi = {
  upload: (slug: string, file: File) => {
    const fd = new FormData()
    fd.append("image", file)
    return apiClient.post<ApiResource<Course>>(`/admin/courses/${encodeURIComponent(slug)}/cover`, fd)
  },
  addImage: (slug: string, file: File) => {
    const fd = new FormData()
    fd.append("image", file)
    return apiClient.post<ApiResource<Course>>(`/admin/courses/${encodeURIComponent(slug)}/images`, fd)
  },
  removeImage: (slug: string, id: number) =>
    apiClient.delete<ApiResource<Course>>(`/admin/courses/${encodeURIComponent(slug)}/images/${id}`),
  remove: (slug: string) => apiClient.delete<ApiResource<Course>>(`/admin/courses/${encodeURIComponent(slug)}/cover`),
}