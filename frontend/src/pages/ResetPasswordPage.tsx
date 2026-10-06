import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { authApi } from "../api/auth"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import Button from "../components/Button"
import FormField from "../components/FormField"

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const email = params.get("email") ?? ""
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!token || !email) {
    return (
      <div className="mx-auto max-w-sm space-y-4 py-2 text-center sm:py-6">
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("auth.reset_invalid_link")}</p>
        <Link to="/mot-de-passe/oublie" className="font-semibold text-primary">{t("auth.request_new_link")}</Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    if (password !== confirmation) {
      setFieldErrors({ password_confirmation: t("auth.password_mismatch") })
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword({ token, email, password, password_confirmation: confirmation })
      toast.success(t("auth.reset_ok"))
      navigate(params.get("portail") === "etudiant" ? "/etudiant/connexion" : "/connexion", { replace: true })
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-2 sm:py-6">
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t("auth.reset_title")}</h1>
      <p className="mb-6 text-sm text-muted">{t("auth.reset_intro")}</p>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <FormField label={t("auth.email")} type="email" readOnly autoComplete="email" value={email} onChange={() => undefined} error={fieldErrors.email} />
        <FormField label={t("auth.new_password")} type="password" required minLength={8} autoComplete="new-password" autoFocus hint={t("auth.password_hint")} value={password} onChange={setPassword} error={fieldErrors.password} />
        <FormField label={t("auth.confirm_password")} type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={setConfirmation} error={fieldErrors.password_confirmation} />
        {error && (
          <div role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <p>{error}</p>
            <Link to="/mot-de-passe/oublie" className="mt-1 inline-block font-semibold underline">{t("auth.request_new_link")}</Link>
          </div>
        )}
        <Button type="submit" size="lg" full loading={loading}>
          {loading ? t("auth.reset_saving") : t("auth.reset_btn")}
        </Button>
      </form>
    </div>
  )
}