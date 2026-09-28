import axios from "axios"
import i18n from "../i18n"
import type { ApiErrorBody } from "../types"

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data
    const firstFieldError = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined
    return firstFieldError ?? body?.message ?? i18n.t("errors.network")
  }
  return i18n.t("errors.unexpected")
}