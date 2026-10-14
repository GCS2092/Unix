import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CircleAlert, Clock, Lock, PackageOpen, SearchX, ServerCrash, WifiOff, type LucideIcon } from "lucide-react"
import { getErrorInfo } from "../lib/errors"
import Button from "./Button"
import RoadLoader from "./RoadLoader"
import { buttonClass } from "./buttonStyles"

type Tone = "muted" | "danger" | "primary"
const TONE: Record<Tone, string> = {
  muted: "bg-line/60 text-muted",
  danger: "bg-danger/10 text-danger",
  primary: "bg-primary/10 text-primary",
}

function StateIcon({ icon: Icon, tone = "muted" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <div className={`animate-fade-up mx-auto flex h-16 w-16 items-center justify-center rounded-full ${TONE[tone]}`}>
      <Icon className="h-8 w-8" strokeWidth={1.6} aria-hidden="true" />
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

const ICONS: Record<string, LucideIcon> = {
  offline: WifiOff,
  timeout: Clock,
  network: ServerCrash,
  server: ServerCrash,
  not_found: SearchX,
  forbidden: Lock,
  unauthorized: Lock,
  rate_limit: Clock,
}

export function LoadingState() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-muted">
      <RoadLoader />
      </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  const info = getErrorInfo(error)
  const [key, fallback] = TITLES[info.kind] ?? ["errors.title_default", "Une erreur est survenue"]
  const Icon = ICONS[info.kind] ?? CircleAlert

  return (
    <div role="alert" className="mx-auto max-w-sm py-12 text-center">
      <StateIcon icon={Icon} tone="danger" />
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
  icon?: LucideIcon
  children?: ReactNode
}

export function EmptyState({ message, description, actionTo, actionLabel, onAction, icon, children }: EmptyProps) {
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <StateIcon icon={icon ?? PackageOpen} tone="primary" />
      <p className="mt-4 font-semibold">{message}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {actionTo && actionLabel && (
        <Link to={actionTo} className={buttonClass({ className: "mt-4" })}>{actionLabel}</Link>
      )}
      {onAction && actionLabel && (
        <Button variant="secondary" className="mt-4" onClick={onAction}>{actionLabel}</Button>
      )}
      {children}
    </div>
  )
}