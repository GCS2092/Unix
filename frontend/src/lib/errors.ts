import axios from "axios"
import i18n from "../i18n"
import type { ApiErrorBody } from "../types"

export type ErrorKind =
  | "offline" | "timeout" | "network" | "unauthorized" | "forbidden" | "not_found"
  | "expired" | "validation" | "rate_limit" | "server" | "unknown"

export interface ErrorInfo {
  kind: ErrorKind
  status?: number
  message: string
  retryable: boolean
}

const tr = (key: string, fallback: string) => i18n.t(key, { defaultValue: fallback })

export function getErrorInfo(error: unknown): ErrorInfo {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return { kind: "unknown", message: tr("errors.unexpected", "Une erreur inattendue est survenue."), retryable: false }
  }

  const res = error.response
  if (!res) {
    if (!navigator.onLine) return { kind: "offline", message: tr("errors.offline", "Vous êtes hors ligne. Vérifiez votre connexion."), retryable: true }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return { kind: "timeout", message: tr("errors.timeout", "Le serveur met trop de temps à répondre."), retryable: true }
    return { kind: "network", message: tr("errors.network", "Impossible de joindre le serveur."), retryable: true }
  }

  const { status, data } = res
  const firstField = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  const serverMessage = firstField ?? data?.message

  if (status === 401) return { kind: "unauthorized", status, message: tr("errors.session_expired", "Votre session a expiré. Reconnectez-vous."), retryable: false }
  if (status === 403) return { kind: "forbidden", status, message: serverMessage ?? tr("errors.forbidden", "Vous n'avez pas accès à cette ressource."), retryable: false }
  if (status === 404) return { kind: "not_found", status, message: tr("errors.not_found", "Cet élément est introuvable."), retryable: false }
  if (status === 419) return { kind: "expired", status, message: tr("errors.csrf", "La page a expiré. Rechargez-la puis réessayez."), retryable: false }
  if (status === 422) return { kind: "validation", status, message: serverMessage ?? tr("errors.validation", "Certaines informations sont invalides."), retryable: false }
  if (status === 429) return { kind: "rate_limit", status, message: tr("errors.rate_limit", "Trop de tentatives. Patientez un instant."), retryable: true }
  if (status >= 500) return { kind: "server", status, message: tr("errors.server", "Un problème est survenu de notre côté. Réessayez."), retryable: true }
  return { kind: "unknown", status, message: serverMessage ?? tr("errors.unexpected", "Une erreur inattendue est survenue."), retryable: false }
}

export const getErrorMessage = (error: unknown) => getErrorInfo(error).message