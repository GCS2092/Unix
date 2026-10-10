import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import { getErrorInfo } from "../lib/errors"
import Button from "../components/Button"

const inputClass =
  "mt-1 min-h-[48px] w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 font-mono text-base uppercase tracking-wider outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

// Suivi sans compte : l'identifiant CMD-XXXX-XXXX recu a la commande suffit
export default function TrackLookupPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const navigate = useNavigate()
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const T = fr
    ? {
        title: "Suivre ma commande",
        intro: "Entrez l'identifiant re\u00e7u par e-mail, par exemple CMD-7K4Q-9XPM. Aucun compte n'est n\u00e9cessaire.",
        label: "Identifiant de commande",
        button: "Suivre ma commande",
        loading: "Recherche\u2026",
        hint: "Vous le trouverez dans l'e-mail de confirmation et sur la page de suivi de votre commande.",
        empty: "Saisissez l'identifiant de votre commande.",
        notFound: "Aucune commande ne correspond \u00e0 cet identifiant. V\u00e9rifiez-le dans votre e-mail de confirmation.",
        rate: "Trop de tentatives. Patientez une minute avant de r\u00e9essayer.",
        account: "Vous avez un compte ?",
        login: "Connectez-vous pour voir toutes vos commandes.",
      }
    : {
        title: "Track my order",
        intro: "Enter the reference from your email, for example CMD-7K4Q-9XPM. No account needed.",
        label: "Order reference",
        button: "Track my order",
        loading: "Searching\u2026",
        hint: "You will find it in your confirmation email and on your order tracking page.",
        empty: "Enter your order reference.",
        notFound: "No order matches this reference. Check it in your confirmation email.",
        rate: "Too many attempts. Please wait a minute and try again.",
        account: "Have an account?",
        login: "Log in to see all your orders.",
      }

  const lookup = useMutation({
    mutationFn: async (value: string) => (await ordersApi.lookup(value)).data.data.token,
    onSuccess: (token) => navigate(`/suivi/${encodeURIComponent(token)}`),
    onError: (e) => {
      const info = getErrorInfo(e)
      setMessage(
        info.kind === "not_found" ? T.notFound : info.kind === "rate_limit" ? T.rate : info.kind === "validation" ? T.empty : info.message,
      )
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = code.trim()
    if (value === "") {
      setMessage(T.empty)
      return
    }
    setMessage(null)
    lookup.mutate(value)
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{T.title}</h1>
      <p className="mt-2 text-sm text-muted">{T.intro}</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <label className="block text-sm font-medium">
          {T.label}
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CMD-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            aria-invalid={message !== null}
            className={inputClass}
          />
        </label>
        {message && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>
        )}
        <Button type="submit" size="lg" full loading={lookup.isPending}>
          {lookup.isPending ? T.loading : T.button}
        </Button>
        <p className="text-xs text-muted">{T.hint}</p>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {T.account}{" "}
        <Link to="/connexion" className="font-semibold text-primary hover:underline">{T.login}</Link>
      </p>
    </div>
  )
}