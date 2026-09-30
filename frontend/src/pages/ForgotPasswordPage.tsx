import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { authApi } from "../api/auth"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import Button from "../components/Button"
import FormField from "../components/FormField"

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-2 sm:py-6">
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t("auth.forgot_title")}</h1>
      {sent ? (
        <div className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
          <p role="status" className="text-sm">{t("auth.forgot_sent")}</p>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">{t("auth.forgot_intro")}</p>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
            <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" autoFocus value={email} onChange={setEmail} error={fieldErrors.email} />
            {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" full loading={loading}>
              {loading ? t("auth.forgot_sending") : t("auth.forgot_btn")}
            </Button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/connexion" className="font-semibold text-primary">{t("auth.back_to_login")}</Link>
      </p>
    </div>
  )
}