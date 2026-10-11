import { useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import type { User } from "../types"
import Button from "./Button"
import FormField from "./FormField"
import PreferencesMenu from "./PreferencesMenu"
import { LoadingState } from "./States"

// Cadre commun des pages d'entree des portails (sans le menu de la boutique)
export function PortalFrame({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="text-lg font-extrabold tracking-tight text-primary">
          UNIX <span className="text-sm font-semibold text-muted">{brand}</span>
        </span>
        <PreferencesMenu />
      </header>
      <div className="mx-auto w-full max-w-sm px-4 py-6 sm:py-10">{children}</div>
    </div>
  )
}

export interface PortalLoginProps {
  brand: string
  title: string
  subtitle: string
  home: string
  allow: (u: User) => boolean
  denied: string
  logoutLabel: string
  footer?: ReactNode
}

export default function PortalLogin(p: PortalLoginProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const asked = (location.state as { from?: string } | null)?.from
  const from = asked && asked.startsWith(p.home) ? asked : p.home

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (authLoading) return <LoadingState />
  if (user && p.allow(user)) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      await login(email.trim(), password)
      const logged = useAuthStore.getState().user
      if (!logged || !p.allow(logged)) {
        // Identifiants valides, mais ce compte n'a pas acces a cet espace : on referme la session
        await logout().catch(() => undefined)
        setError(p.denied)
        setLoading(false)
        return
      }
      toast.success(t("auth.login_ok"))
      navigate(from, { replace: true })
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  // Deja connecte, mais avec un compte sans acces a cet espace
  if (user) {
    return (
      <PortalFrame brand={p.brand}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{p.denied}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <Button variant="secondary" full onClick={() => void logout()}>{p.logoutLabel}</Button>
        </div>
        {p.footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{p.footer}</div>}
      </PortalFrame>
    )
  }

  return (
    <PortalFrame brand={p.brand}>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{p.title}</h1>
        <p className="mt-2 text-sm text-muted">{p.subtitle}</p>
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

      {p.footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{p.footer}</div>}
    </PortalFrame>
  )
}