import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { emailVerificationApi } from "../api/emailVerification"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import { useAuthStore } from "../stores/authStore"
import PublicHeader from "../components/PublicHeader"
import Footer from "../components/Footer"
import { usePageTitle } from "../hooks/usePageTitle"

const LEN = 6

/** Ecran dedie affiche juste apres la creation du compte : saisie du code a 6 chiffres recu par e-mail. */
export default function VerificationCodePage() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  usePageTitle(L("Vérification de l'e-mail", "Email verification"))

  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const rawFrom = (location.state as { from?: string } | null)?.from
  const back = rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//") && !rawFrom.startsWith("/admin") ? rawFrom : "/"

  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""))
  const [wait, setWait] = useState(60)
  const [error, setError] = useState("")
  const [ok, setOk] = useState(false)
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const lastSent = useRef("")
  const code = digits.join("")

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  useEffect(() => { refs.current[0]?.focus() }, [])

  function done() {
    toast.success(L("Adresse e-mail confirmée.", "Email address confirmed."))
    void qc.invalidateQueries({ queryKey: ["account-me"] })
    useAuthStore.setState((s) => ({ notice: s.notice ? { ...s.notice, verified: true } : s.notice }))
    setOk(true)
  }

  useEffect(() => {
    if (!ok) return
    const id = setTimeout(() => navigate(back, { replace: true }), 1800)
    return () => clearTimeout(id)
  }, [ok, back, navigate])

  const confirm = useMutation({
    mutationFn: (c: string) => emailVerificationApi.confirmCode(c),
    onSuccess: () => done(),
    onError: (e) => {
      setError(getErrorMessage(e))
      setDigits(Array(LEN).fill(""))
      lastSent.current = ""
      refs.current[0]?.focus()
    },
  })

  const send = useMutation({
    mutationFn: () => emailVerificationApi.sendCode(),
    onSuccess: ({ data }) => {
      if (data.data.verified) { done(); return }
      toast.success(L("Nouveau code envoyé par e-mail.", "New code sent by email."))
      setError("")
      setWait(60)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  // Validation automatique des que les 6 chiffres sont saisis
  useEffect(() => {
    if (code.length === LEN && lastSent.current !== code && !confirm.isPending) {
      lastSent.current = code
      setError("")
      confirm.mutate(code)
    }
  }, [code, confirm])

  function fill(start: number, raw: string) {
    const chars = raw.replace(/\D/g, "").slice(0, LEN - start).split("")
    if (chars.length === 0) return
    const next = [...digits]
    chars.forEach((c, k) => { next[start + k] = c })
    setDigits(next)
    refs.current[Math.min(start + chars.length, LEN - 1)]?.focus()
  }

  function onChange(i: number, v: string) {
    if (v === "") {
      const next = [...digits]
      next[i] = ""
      setDigits(next)
      return
    }
    fill(i, v)
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault()
      const next = [...digits]
      next[i - 1] = ""
      setDigits(next)
      refs.current[i - 1]?.focus()
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    fill(0, e.clipboardData.getData("text"))
  }

  if (!user) return <Navigate to="/connexion" replace />

  return (
    <div className="min-h-screen bg-page">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="space-y-5 rounded-card border border-line bg-surface p-6 text-center shadow-card">
          {ok ? (
            <>
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl text-success">✓</span>
              <h1 className="text-xl font-bold">{L("Adresse confirmée", "Address confirmed")}</h1>
              <p className="text-sm text-muted">{L("Bienvenue ! Redirection en cours…", "Welcome! Redirecting…")}</p>
              <button type="button" onClick={() => navigate(back, { replace: true })} className="min-h-[44px] rounded-lg bg-primary px-5 text-sm font-semibold text-white">
                {L("Continuer", "Continue")}
              </button>
            </>
          ) : (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary" aria-hidden="true">✉</span>
              <div className="space-y-1">
                <h1 className="text-xl font-bold">{L("Vérifiez votre e-mail", "Check your email")}</h1>
                <p className="text-sm text-muted">
                  {L("Nous avons envoyé un code à 6 chiffres à", "We sent a 6-digit code to")}{" "}
                  <span className="font-semibold text-ink break-all">{user.email}</span>
                </p>
              </div>

              <div className="flex justify-center gap-2" role="group" aria-label={L("Code de vérification", "Verification code")}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { refs.current[i] = el }}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`${L("Chiffre", "Digit")} ${i + 1}`}
                    maxLength={i === 0 ? LEN : 1}
                    disabled={confirm.isPending}
                    onChange={(e) => onChange(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onPaste={onPaste}
                    onFocus={(e) => e.target.select()}
                    className={`h-14 w-11 rounded-lg border bg-surface text-center text-2xl font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:w-12 ${error ? "border-danger" : "border-line"}`}
                  />
                ))}
              </div>

              <div aria-live="polite" className="min-h-[20px] text-sm">
                {confirm.isPending && <p className="text-muted">{L("Vérification…", "Checking…")}</p>}
                {error && !confirm.isPending && <p role="alert" className="font-medium text-danger">{error}</p>}
              </div>

              <p className="text-xs text-muted">{L("Le code est valable 15 minutes. Pensez à vérifier vos courriers indésirables.", "The code is valid for 15 minutes. Check your spam folder too.")}</p>

              <button
                type="button"
                disabled={wait > 0 || send.isPending}
                onClick={() => send.mutate()}
                className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
              >
                {wait > 0 ? L(`Renvoyer le code (${wait} s)`, `Resend code (${wait} s)`) : L("Renvoyer le code", "Resend code")}
              </button>

              <p className="text-sm">
                <Link to={back} replace className="font-semibold text-primary hover:underline">{L("Plus tard", "Later")}</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}