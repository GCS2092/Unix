import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { getErrorInfo } from "../lib/errors"
import Button, { buttonClass } from "./Button"

function StateIcon({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-line/60 text-muted">
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </div>
  )
}

const TITLES: Record<string, [string, string]> = {
  offline: ["errors.title_offline", "Pas de connexion"],
  timeout: ["errors.title_timeout", "Trop long à répondre"],
  network: ["errors.title_network", "Serveur injoignable"],
  server: ["errors.title_server", "Un souci de notre côté"],
  not_found: ["errors.title_not_found", "Introuvable"],
  forbidden: ["errors.title_forbidden", "Accès refusé"],
  unauthorized: ["errors.title_unauthorized", "Session expirée"],
  rate_limit: ["errors.title_rate_limit", "Trop de tentatives"],
}

export function LoadingState() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-muted">
      <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{t("states.loading")}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  const info = getErrorInfo(error)
  const [key, fallback] = TITLES[info.kind] ?? ["errors.title_default", "Une erreur est survenue"]

  return (
    <div role="alert" className="mx-auto max-w-sm py-12 text-center">
      <StateIcon><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></StateIcon>
      <h2 className="mt-4 text-lg font-semibold">{t(key, { defaultValue: fallback })}</h2>
      <p className="mt-1 text-sm text-muted">{info.message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && info.retryable && <Button onClick={onRetry}>{t("states.retry")}</Button>}
        {info.kind === "unauthorized" && (
          <Link to="/connexion" className={buttonClass()}>{t("nav.login")}</Link>
        )}
        {!info.retryable && info.kind !== "unauthorized" && (
          <Link to="/" className={buttonClass({ variant: "secondary" })}>{t("common.back_home")}</Link>
        )}
      </div>
    </div>
  )
}

interface EmptyProps {
  message: string
  description?: string
  actionTo?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ message, description, actionTo, actionLabel, onAction }: EmptyProps) {
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <StateIcon><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></StateIcon>
      <p className="mt-4 font-semibold">{message}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {actionTo && actionLabel && (
        <Link to={actionTo} className={buttonClass({ className: "mt-4" })}>{actionLabel}</Link>
      )}
      {onAction && actionLabel && (
        <Button variant="secondary" className="mt-4" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}