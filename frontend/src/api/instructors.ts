import { apiClient } from "./client"

export interface InstructorRow { id: number; name: string; email: string }

export const instructorsApi = {
  list: () => apiClient.get<{ data: InstructorRow[] }>("/admin/formations/instructors"),
}
