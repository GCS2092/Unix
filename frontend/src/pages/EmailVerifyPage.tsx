import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { emailVerificationApi } from "../api/emailVerification"
import { getErrorMessage } from "../lib/errors"
import { useAuthStore } from "../stores/authStore"
import PublicHeader from "../components/PublicHeader"
import Footer from "../components/Footer"
import { usePageTitle } from "../hooks/usePageTitle"

type State = "idle" | "loading" | "ok" | "error"

/** Le lien de l'e-mail ouvre cette page ; la validation part en POST au clic (un scanner d'e-mails ne peut pas valider). */
export default function EmailVerifyPage() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  usePageTitle(L("Confirmation de l'adresse e-mail", "Email confirmation"))
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const id = Number(params.get("u"))
  const token = params.get("t") ?? ""
  const valid = Number.isInteger(id) && id > 0 && token.length === 40
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")

  async function confirm() {
    setState("loading")
    try {
      await emailVerificationApi.confirmLink(id, token)
      void qc.invalidateQueries({ queryKey: ["account-me"] })
      useAuthStore.setState((s) => ({ notice: s.notice ? { ...s.notice, verified: true } : s.notice }))
      setState("ok")
    } catch (e) {
      setMessage(getErrorMessage(e))
      setState("error")
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card">
          {state === "ok" ? (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success">✓</span>
              <h1 className="text-xl font-bold">{L("Adresse confirmée", "Address confirmed")}</h1>
              <p className="text-sm text-muted">{L("Merci, votre adresse e-mail est vérifiée.", "Thank you, your email address is verified.")}</p>
              <Link to="/etudiant" className="inline-block min-h-[44px] rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                {L("Continuer", "Continue")}
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{L("Confirmer mon adresse e-mail", "Confirm my email address")}</h1>
              {!valid ? (
                <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {L("Lien incomplet. Rouvrez le bouton de l'e-mail ou saisissez le code depuis votre compte.", "Incomplete link. Reopen the email button or enter the code from your account.")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted">{L("Cliquez sur le bouton pour terminer la vérification.", "Click the button to finish the verification.")}</p>
                  {state === "error" && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>}
                  <button
                    type="button" disabled={state === "loading"} onClick={() => void confirm()}
                    className="min-h-[48px] w-full rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
                  >
                    {state === "loading" ? L("Vérification…", "Checking…") : L("Confirmer mon adresse", "Confirm my address")}
                  </button>
                </>
              )}
              <p className="text-sm"><Link to="/compte" className="font-semibold text-primary hover:underline">{L("Aller à mon compte", "Go to my account")}</Link></p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}