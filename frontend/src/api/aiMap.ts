import { apiClient } from "./client"

export interface AiSuggestion {
  index: number
  field: string
}

export interface AiColumnInput {
  index: number
  header: string
  samples: string[]
}

export const aiMapApi = {
  suggest: async (kind: string, columns: AiColumnInput[]): Promise<AiSuggestion[]> =>
    (await apiClient.post<{ data: { suggestions: AiSuggestion[] } }>("/admin/ai-map", { kind, columns }, { timeout: 60_000 })).data.data.suggestions,
}