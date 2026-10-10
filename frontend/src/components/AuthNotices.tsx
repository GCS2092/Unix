import { useSearchParams } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { authApi } from "../api/auth"
import { useAuthStore } from "../stores/authStore"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "./Button"

const box = "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"

// Bandeaux apres connexion : commandes rattachees, adresse e-mail a confirmer
export default function AuthNotices() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const notice = useAuthStore((s) => s.notice)
  const [params] = useSearchParams()
  const verified = params.get("verified")

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(),
    onSuccess: () =>
      toast.success(fr ? "E-mail envoy\u00e9. V\u00e9rifiez votre bo\u00eete de r\u00e9ception." : "Email sent. Check your inbox."),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const count = (n: number) =>
    fr ? `${n} commande${n > 1 ? "s" : ""} rattach\u00e9e${n > 1 ? "s" : ""} \u00e0 votre compte.` : `${n} order${n > 1 ? "s" : ""} linked to your account.`

  const showVerified = verified !== null
  const showAttached = !!notice && notice.attached > 0
  const showVerify = !!notice && notice.verified === false
  if (!showVerified && !showAttached && !showVerify) return null

  return (
    <div>
      {showVerified && (
        <p role="status" className={`${box} bg-success/10 font-medium text-success`}>
          {fr ? "Adresse e-mail confirm\u00e9e. " : "Email address confirmed. "}
          {Number(verified) > 0 ? count(Number(verified)) : ""}
        </p>
      )}
      {showAttached && (
        <p role="status" className={`${box} bg-success/10 font-medium text-success`}>
          <span>{count(notice.attached)}</span>
          <button type="button" onClick={() => useAuthStore.setState({ notice: null })} className="text-xs font-semibold underline">
            {fr ? "Fermer" : "Dismiss"}
          </button>
        </p>
      )}
      {showVerify && (
        <div role="status" className={`${box} bg-primary/10 text-primary`}>
          <span>
            {fr
              ? "Confirmez votre e-mail pour retrouver ici vos commandes pass\u00e9es en invit\u00e9."
              : "Confirm your email to find your guest orders here."}
          </span>
          <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
            {fr ? "Renvoyer le lien" : "Resend link"}
          </Button>
        </div>
      )}
    </div>
  )
}