import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { emailVerificationApi } from "../api/emailVerification"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import { useAuthStore } from "../stores/authStore"

const btnPrimary =
  "min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"

/** Saisie du code de verification recu par e-mail. justSent : un e-mail vient de partir (compte tout juste cree). */
export default function EmailCodeBox({ justSent = false, onVerified }: { justSent?: boolean; onVerified?: () => void }) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [code, setCode] = useState("")
  const [wait, setWait] = useState(justSent ? 60 : 0)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  function done() {
    toast.success(L("Adresse e-mail confirmée.", "Email address confirmed."))
    void qc.invalidateQueries({ queryKey: ["account-me"] })
    setOk(true)
    useAuthStore.setState((s) => ({ notice: s.notice ? { ...s.notice, verified: true } : s.notice }))
    onVerified?.()
  }

  const send = useMutation({
    mutationFn: () => emailVerificationApi.sendCode(),
    onSuccess: ({ data }) => {
      if (data.data.verified) { done(); return }
      toast.success(L("Code envoyé par e-mail.", "Code sent by email."))
      setWait(60)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const confirm = useMutation({
    mutationFn: () => emailVerificationApi.confirmCode(code),
    onSuccess: () => done(),
    onError: (e) => { toast.error(getErrorMessage(e)); setCode("") },
  })

  if (ok) {
    return <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">{L("Adresse e-mail confirmée.", "Email address confirmed.")}</p>
  }
  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (code.length === 6) confirm.mutate() }}
      className="space-y-3 rounded-lg border border-line bg-page p-3 text-left"
    >
      <p className="text-sm font-semibold">{L("Confirmez votre adresse e-mail", "Confirm your email address")}</p>
      <p className="text-sm text-muted">
        {L("Saisissez le code à 6 chiffres reçu par e-mail (valable 15 minutes).", "Enter the 6-digit code sent by email (valid for 15 minutes).")}
      </p>
      <input
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
        aria-label={L("Code de vérification", "Verification code")}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="min-h-[48px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-center text-xl font-semibold tracking-[0.4em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={code.length !== 6 || confirm.isPending} className={btnPrimary}>
          {confirm.isPending ? L("Vérification…", "Checking…") : L("Confirmer", "Confirm")}
        </button>
        <button type="button" disabled={wait > 0 || send.isPending} onClick={() => send.mutate()} className={btnGhost}>
          {wait > 0 ? L(`Renvoyer le code (${wait} s)`, `Resend code (${wait} s)`) : L("Recevoir un code", "Send me a code")}
        </button>
      </div>
    </form>
  )
}