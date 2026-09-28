import { isAxiosError } from "axios"
import type { ApiErrorBody } from "../types"

// Transforme les erreurs 422 de Laravel en { champ: "premier message" }
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError<ApiErrorBody>(error)) return {}
  const errors = error.response?.data?.errors ?? {}
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0] ?? ""]))
}