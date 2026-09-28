import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { getErrorMessage } from "../lib/errors"
import Button, { buttonClass } from "./Button"

export function LoadingState() {
  const { t } = useTranslation()
  return <p role="status" className="py-16 text-center text-muted">{t("states.loading")}</p>
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="py-12 text-center">
      <p className="text-danger">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>{t("states.retry")}</Button>
      )}
    </div>
  )
}

export function EmptyState({ message, actionTo, actionLabel }: { message: string; actionTo?: string; actionLabel?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-muted">{message}</p>
      {actionTo && actionLabel && (
        <Link to={actionTo} className={buttonClass({ className: "mt-4" })}>{actionLabel}</Link>
      )}
    </div>
  )
}