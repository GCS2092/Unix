import { apiClient } from "./client"

export type FaqSpace = "shop" | "formation"

export interface Faq {
  id: number
  space: FaqSpace
  position: number
  is_published: boolean
  category_fr: string | null
  category_en: string | null
  question_fr: string
  answer_fr: string
  question_en: string | null
  answer_en: string | null
}

export type FaqInput = {
  question_fr: string
  answer_fr: string
  question_en: string
  answer_en: string
  category_fr: string
  category_en: string
  is_published: boolean
}

const base = (space: FaqSpace) => `/admin/${space}-faqs`

export const faqApi = {
  publicList: (space: FaqSpace) => apiClient.get<{ data: Faq[] }>("/faqs", { params: { space } }),
  adminList: (space: FaqSpace) => apiClient.get<{ data: Faq[] }>(base(space)),
  create: (space: FaqSpace, p: FaqInput) => apiClient.post<{ data: Faq }>(base(space), p),
  update: (space: FaqSpace, id: number, p: Partial<FaqInput>) => apiClient.patch<{ data: Faq }>(`${base(space)}/${id}`, p),
  remove: (space: FaqSpace, id: number) => apiClient.delete<{ data: { id: number } }>(`${base(space)}/${id}`),
  reorder: (space: FaqSpace, ids: number[]) => apiClient.post<{ data: { count: number } }>(`${base(space)}/reorder`, { ids }),
}