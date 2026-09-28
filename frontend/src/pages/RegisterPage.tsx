import { useTranslation } from "react-i18next"
import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import Button from "../components/Button"
import FormField from "../components/FormField"

export default function RegisterPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const register = useAuthStore((s) => s.register)
  const fetchCart = useCartStore((s) => s.fetch)
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (user) return <Navigate to="/" replace />

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
      await register(name.trim(), email.trim(), password, confirmation)
      toast.success(t("auth.register_ok"))
      await fetchCart().catch(() => undefined)
      navigate("/", { replace: true })
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-2 sm:py-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("auth.register_title")}</h1>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <FormField label={t("auth.name")} required autoComplete="name" autoFocus value={name} onChange={setName} error={fieldErrors.name} />
        <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={fieldErrors.email} />
        <FormField label={t("auth.password")} type="password" required minLength={8} autoComplete="new-password" hint={t("auth.password_hint")} value={password} onChange={setPassword} error={fieldErrors.password} />
        <FormField label={t("auth.confirm_password")} type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={setConfirmation} error={fieldErrors.password_confirmation} />
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" full loading={loading}>
          {loading ? t("auth.creating") : t("auth.register_btn")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {t("auth.already")} <Link to="/connexion" className="font-semibold text-primary">{t("auth.login_link")}</Link>
      </p>
    </div>
  )
}