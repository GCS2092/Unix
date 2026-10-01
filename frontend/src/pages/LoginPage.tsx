import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import Button from "../components/Button"
import FormField from "../components/FormField"

export default function LoginPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const fetchCart = useCartStore((s) => s.fetch)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (user) return <Navigate to={user.is_admin ? "/admin" : from} replace />

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success(t("auth.login_ok"))
      await fetchCart().catch(() => undefined)
      const logged = useAuthStore.getState().user
      navigate(logged?.is_admin ? "/admin" : from, { replace: true })
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm py-6 sm:py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("auth.login_title")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("auth.login_subtitle", { defaultValue: "Content de vous revoir. Connectez-vous pour suivre vos commandes." })}
        </p>
      </header>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" autoFocus value={email} onChange={setEmail} error={fieldErrors.email} />

        <div>
          <FormField label={t("auth.password")} type="password" required autoComplete="current-password" value={password} onChange={setPassword} error={fieldErrors.password} />
          <div className="mt-2 text-right">
            <Link to="/mot-de-passe/oublie" className="text-xs font-semibold text-primary hover:underline">
              {t("auth.forgot_link")}
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" full loading={loading}>
          {loading ? t("auth.logging_in") : t("auth.login_btn")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.no_account")}{" "}
        <Link to="/inscription" className="font-semibold text-primary hover:underline">
          {t("auth.create_account")}
        </Link>
      </p>
    </div>
  )
}