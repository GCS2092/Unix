import { apiClient } from "./client"

export interface Metric {
  value: number
  previous: number
  change: number | null
}

export interface FormationsDashboard {
  summary: {
    students_total: number
    students_without_course: number
    active_students_30d: number
    courses_total: number
    courses_published: number
    courses_live: number
    enrollments_total: number
    in_progress: number
    completed: number
    completion_rate: number
    avg_progress: number
    certificates_total: number
  }
  period: { enrollments: Metric; completed: Metric; certificates: Metric }
  stalled_count: number
  stalled: {
    id: number
    user_name: string | null
    user_email: string | null
    course_title: string | null
    progress: number
    last_activity: string | null
  }[]
  to_enroll: { id: number; name: string; email: string }[]
  top_courses: {
    id: number
    title: string
    is_published: boolean
    enrollments: number
    completed: number
    avg_progress: number
  }[]
  recent: {
    id: number
    user_name: string | null
    user_email: string | null
    course_title: string | null
    progress: number
    completed: boolean
    created_at: string | null
  }[]
}

export interface StudentResult {
  data: { id: number; name: string; email: string }
  created: boolean
  mail_sent: boolean
  orders_count: number
  enrolled: boolean
}

export const formationsApi = {
  dashboard: () => apiClient.get<{ data: FormationsDashboard }>("/admin/formations/dashboard"),
  createStudent: (p: { email: string; name?: string; phone?: string; course_id?: number }) =>
    apiClient.post<StudentResult>("/admin/formations/students", p),
  enroll: (p: { user_id: number; course_id: number }) =>
    apiClient.post<{ data: { id: number } }>("/admin/formations/enroll", p),
}