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

function passwordScore(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function StrengthMeter({ password }: { password: string }) {
  const { t } = useTranslation()
  if (!password) return null
  const score = Math.max(1, passwordScore(password))
  const labels = [
    "",
    t("auth.strength_weak", { defaultValue: "Faible" }),
    t("auth.strength_fair", { defaultValue: "Moyen" }),
    t("auth.strength_good", { defaultValue: "Bon" }),
    t("auth.strength_strong", { defaultValue: "Excellent" }),
  ]
  const color = score <= 2 ? "bg-danger" : "bg-primary"
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? color : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{labels[score]}</p>
    </div>
  )
}

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

  const liveMismatch = confirmation.length > 0 && confirmation !== password

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
    <div className="mx-auto w-full max-w-sm py-6 sm:py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("auth.register_title")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("auth.register_subtitle", { defaultValue: "Suivez vos commandes et commandez plus vite." })}
        </p>
      </header>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <FormField label={t("auth.name")} required autoComplete="name" autoFocus value={name} onChange={setName} error={fieldErrors.name} />
        <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={fieldErrors.email} />

        <div>
          <FormField label={t("auth.password")} type="password" required minLength={8} autoComplete="new-password" hint={t("auth.password_hint")} value={password} onChange={setPassword} error={fieldErrors.password} />
          <StrengthMeter password={password} />
        </div>

        <FormField
          label={t("auth.confirm_password")}
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={fieldErrors.password_confirmation ?? (liveMismatch ? t("auth.password_mismatch") : undefined)}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" full loading={loading} disabled={liveMismatch}>
          {loading ? t("auth.creating") : t("auth.register_btn")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.already")}{" "}
        <Link to="/connexion" className="font-semibold text-primary hover:underline">
          {t("auth.login_link")}
        </Link>
      </p>
    </div>
  )
}