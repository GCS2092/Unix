import { apiClient } from "./client"

export interface ExamQuestion {
  id: number
  prompt: string
  options: string[]
}

export interface Exam {
  id: number
  title: string | null
  passing_score: number
  max_attempts: number
  attempts_used: number
  best_score: number
  passed: boolean
  video_done: boolean
  questions: ExamQuestion[]
}

export interface ExamResult {
  score: number
  passed: boolean
  correct: number
  total: number
  passing_score: number
  attempts_used: number
  attempts_left: number
  certificate_id: number | null
}

export interface Verification {
  valid: boolean
  code: string
  holder: string | null
  course: string | null
  issued_at: string | null
}

export interface AdminQuizQuestion {
  id?: number
  prompt: string
  options: string[]
  correct_index: number
}

export interface AdminQuiz {
  id: number
  title: string | null
  passing_score: number
  max_attempts: number
  is_published: boolean
  questions: AdminQuizQuestion[]
}

export interface QuizPayload {
  title: string | null
  passing_score: number
  max_attempts: number
  is_published: boolean
  questions: { prompt: string; options: string[]; correct_index: number }[]
}

export const quizApi = {
  show: (enrollmentId: number) => apiClient.get<{ data: Exam }>(`/enrollments/${enrollmentId}/quiz`),
  submit: (enrollmentId: number, answers: Record<number, number>) =>
    apiClient.post<{ data: ExamResult }>(`/enrollments/${enrollmentId}/quiz/attempts`, { answers }),
  verify: (code: string) =>
    apiClient.get<{ data: Verification }>(`/certificates/verify/${encodeURIComponent(code)}`),
}

export const adminQuizApi = {
  get: (slug: string) => apiClient.get<{ data: AdminQuiz | null }>(`/admin/courses/${slug}/quiz`),
  save: (slug: string, payload: QuizPayload) =>
    apiClient.put<{ data: AdminQuiz }>(`/admin/courses/${slug}/quiz`, payload),
}