import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const KEY = "install_dismissed_at"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000 // refus : on ne redemande pas pendant 30 jours
const DELAY_MS = 20_000 // l'invitation n'apparait qu'apres 20 s de visite
const HIDDEN_ON = [/^\/panier/, /^\/commande/]

function snoozed(): boolean {
  try {
    const v = Number(localStorage.getItem(KEY))
    return v > 0 && Date.now() - v < SNOOZE_MS
  } catch {
    return false
  }
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// Safari sur iPhone/iPad : pas d'invitation automatique, il faut expliquer le geste
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
}

export default function InstallPrompt() {
  const { i18n } = useTranslation()
  const { pathname } = useLocation()
  const fr = i18n.language.startsWith("fr")
  const [skip, setSkip] = useState(() => isStandalone() || snoozed())
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [ready, setReady] = useState(false)
  const [ios] = useState(isIosSafari)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallEvent)
    }
    const onInstalled = () => {
      setEvt(null)
      setSkip(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    const id = window.setTimeout(() => setReady(true), DELAY_MS)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      window.clearTimeout(id)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      // stockage indisponible : on ferme seulement pour cette visite
    }
    setSkip(true)
  }

  async function install() {
    if (!evt) return
    try {
      await evt.prompt()
      await evt.userChoice
    } catch {
      // l'utilisateur a ferme la fenetre du navigateur
    }
    setEvt(null)
    dismiss()
  }

  if (skip || !ready || HIDDEN_ON.some((r) => r.test(pathname)) || (!evt && !ios)) return null

  return (
    <div
      role="dialog"
      aria-label={fr ? "Installer l'application" : "Install the app"}
      className="animate-fade-up fixed left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-30 mx-auto max-w-md rounded-card border border-line bg-surface/95 p-3 shadow-card-lg backdrop-blur md:left-auto md:right-6 md:top-20 md:mx-0"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-extrabold text-white">U</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{fr ? "Ajouter UNIX à l'écran d'accueil" : "Add UNIX to your home screen"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {evt
              ? fr ? "Retrouvez la boutique en un geste, comme une application." : "Open the shop in one tap, like an app."
              : fr ? "Touchez le bouton Partager, puis « Sur l'écran d'accueil »." : "Tap the Share button, then “Add to Home Screen”."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {evt && (
              <button type="button" onClick={() => void install()} className="min-h-[36px] rounded-lg bg-primary px-3 text-sm font-semibold text-white active:scale-95">
                {fr ? "Installer" : "Install"}
              </button>
            )}
            <button type="button" onClick={dismiss} className="min-h-[36px] rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">
              {evt ? (fr ? "Plus tard" : "Not now") : fr ? "Compris" : "Got it"}
            </button>
          </div>
        </div>
        <button type="button" aria-label={fr ? "Fermer" : "Close"} onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-page hover:text-ink">
          ✕
        </button>
      </div>
    </div>
  )
}