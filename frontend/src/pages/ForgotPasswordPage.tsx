import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { authApi } from "../api/auth"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import Button from "../components/Button"
import FormField from "../components/FormField"
import AuthShell from "../components/AuthShell"
import { MailIcon } from "../components/authIcons"

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
    <AuthShell
      icon={<MailIcon />}
      title={t("auth.forgot_title")}
      subtitle={sent ? undefined : t("auth.forgot_intro")}
      below={
        <p className="text-center text-sm">
          <Link to="/connexion" className="font-semibold text-primary hover:underline">{t("auth.back_to_login")}</Link>
        </p>
      }
    >
      {sent ? (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-3 text-sm text-success">{t("auth.forgot_sent")}</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" autoFocus value={email} onChange={setEmail} error={fieldErrors.email} />
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" full loading={loading}>
            {loading ? t("auth.forgot_sending") : t("auth.forgot_btn")}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}