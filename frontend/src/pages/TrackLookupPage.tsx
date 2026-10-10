import { useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ordersApi } from "../api/orders"
import { getErrorInfo } from "../lib/errors"
import Button from "../components/Button"

const inputClass =
  "mt-1 min-h-[48px] w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 font-mono text-base uppercase tracking-wider outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

const REF_LENGTH = "CMD-XXXX-XXXX".length

// Meme regle que le backend : prefixe CMD optionnel, minuscules/espaces/tirets acceptes
function formatRef(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const code = raw.length === 11 && raw.startsWith("CMD") ? raw.slice(3) : raw
  if (code === "") return ""
  return code.length > 4 ? `CMD-${code.slice(0, 4)}-${code.slice(4)}` : `CMD-${code}`
}

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
        paste: "Coller",
        hint: "Vous le trouverez dans l'e-mail de confirmation et sur la page de suivi de votre commande.",
        empty: "Saisissez l'identifiant de votre commande.",
        incomplete: "L'identifiant est incomplet. Il ressemble \u00e0 CMD-XXXX-XXXX.",
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
        paste: "Paste",
        hint: "You will find it in your confirmation email and on your order tracking page.",
        empty: "Enter your order reference.",
        incomplete: "The reference is incomplete. It looks like CMD-XXXX-XXXX.",
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

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setCode(e.target.value)
    if (message) setMessage(null)
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    setCode(formatRef(e.clipboardData.getData("text")))
    setMessage(null)
  }

  async function pasteFromClipboard() {
    try {
      setCode(formatRef(await navigator.clipboard.readText()))
      setMessage(null)
    } catch {
      /* acces au presse-papiers refuse : l'utilisateur peut coller a la main */
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formatted = formatRef(code)
    if (formatted === "") {
      setMessage(T.empty)
      return
    }
    setCode(formatted)
    if (formatted.length !== REF_LENGTH) {
      setMessage(T.incomplete)
      return
    }
    setMessage(null)
    lookup.mutate(formatted)
  }

  const steps = fr
    ? ["Ouvrez l'e-mail de confirmation", "Copiez l'identifiant CMD-XXXX-XXXX", "Collez-le ici et suivez votre commande"]
    : ["Open your confirmation email", "Copy the CMD-XXXX-XXXX reference", "Paste it here and track your order"]

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{T.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{T.intro}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="track-ref" className="text-sm font-medium">{T.label}</label>
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted transition hover:border-primary hover:text-primary"
            >
              {T.paste}
            </button>
          </div>
          <div className="relative mt-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="track-ref"
              type="text"
              value={code}
              onChange={onChange}
              onPaste={onPaste}
              onBlur={() => setCode(formatRef(code))}
              placeholder="CMD-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              aria-invalid={message !== null}
              className={inputClass + " !mt-0 pl-11 text-center text-lg font-semibold"}
            />
          </div>
        </div>
        {message && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>
        )}
        <Button type="submit" size="lg" full loading={lookup.isPending}>
          {lookup.isPending ? T.loading : T.button}
        </Button>
        <p className="text-center text-xs text-muted">{T.hint}</p>
      </form>

      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm text-muted">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xs font-bold text-primary">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        {T.account}{" "}
        <Link to="/connexion" className="font-semibold text-primary hover:underline">{T.login}</Link>
      </p>
    </div>
  )
}