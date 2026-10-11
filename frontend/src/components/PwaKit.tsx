import { useEffect, useState, useSyncExternalStore } from "react"
import { Link, useLocation } from "react-router-dom"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useTranslation } from "react-i18next"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

const SEEN_KEY = "unix:onboarding:v1"

type InstallEvent = Event & { prompt: () => Promise<void> }

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  return {
    installed,
    canPrompt: event !== null,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    install: async () => {
      if (!event) return
      await event.prompt()
      setEvent(null)
    },
  }
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null
  } catch {
    return true
  }
}

const cardCls = "fixed z-[55] rounded-card border border-line bg-surface p-4 shadow-card-lg"
const sheetPos =
  "inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-96"

export default function PwaKit() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const { pathname } = useLocation()
  const online = useOnline()
  const install = useInstall()
  const [seen, setSeen] = useState(readSeen)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Verifie une nouvelle version toutes les heures
      if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
  })

  function closeOnboarding() {
    try {
      localStorage.setItem(SEEN_KEY, "1")
    } catch {
      /* stockage indisponible : le guide reviendra */
    }
    setSeen(true)
  }

  const showOnboarding = !seen && !pathname.startsWith("/admin")
  const showUpdate = needRefresh && !updateDismissed

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[60] bg-ink px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-sm font-medium text-white"
        >
          {L(
            "Vous \u00eates hors ligne. Les pages d\u00e9j\u00e0 visit\u00e9es restent disponibles.",
            "You are offline. Pages you already visited remain available.",
          )}
        </div>
      )}

      {showUpdate && (
        <div role="status" className={`${cardCls} ${sheetPos}`}>
          <p className="text-sm font-semibold">{L("Nouvelle version disponible", "New version available")}</p>
          <p className="mt-1 text-xs text-muted">
            {L("Rechargez quand vous \u00eates pr\u00eat : votre panier est conserv\u00e9.", "Reload when you are ready: your cart is kept.")}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
            >
              {L("Mettre \u00e0 jour", "Update")}
            </button>
            <button
              type="button"
              onClick={() => setUpdateDismissed(true)}
              className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
            >
              {L("Plus tard", "Later")}
            </button>
          </div>
        </div>
      )}

      {showOnboarding && !showUpdate && (
        <div role="dialog" aria-label={L("Bienvenue", "Welcome")} className={`${cardCls} ${sheetPos}`}>
          <p className="text-base font-bold">{L("Bienvenue chez UNIX", "Welcome to UNIX")}</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <p className="font-semibold">{L("Suivre une commande, sans compte", "Track an order, no account needed")}</p>
              <p className="text-xs text-muted">
                {L("Il suffit de l'identifiant CMD-XXXX-XXXX et de l'e-mail de la commande.", "All you need is the CMD-XXXX-XXXX reference and the order email.")}{" "}
                <Link to="/suivi" onClick={closeOnboarding} className="font-semibold text-primary hover:underline">
                  {L("Suivre ma commande", "Track my order")}
                </Link>
              </p>
            </li>
            {!install.installed && (install.canPrompt || install.ios) && (
              <li>
                <p className="font-semibold">{L("Installer l'application", "Install the app")}</p>
                {install.canPrompt ? (
                  <button
                    type="button"
                    onClick={() => void install.install()}
                    className="mt-1 min-h-[40px] rounded-lg border border-primary px-3 text-xs font-semibold text-primary hover:bg-primary/5"
                  >
                    {L("Ajouter \u00e0 l'\u00e9cran d'accueil", "Add to home screen")}
                  </button>
                ) : (
                  <p className="text-xs text-muted">
                    {L("Sur iPhone : touchez Partager, puis \u00ab Sur l'\u00e9cran d'accueil \u00bb.", "On iPhone: tap Share, then \u201cAdd to Home Screen\u201d.")}
                  </p>
                )}
              </li>
            )}
            {WHATSAPP_NUMBER && (
              <li>
                <p className="font-semibold">{L("Une question ?", "A question?")}</p>
                <a
                  href={whatsappUrl(L("Bonjour, j'ai une question.", "Hello, I have a question."))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {L("\u00c9crivez-nous sur WhatsApp", "Message us on WhatsApp")}
                </a>
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={closeOnboarding}
            className="mt-4 min-h-[44px] w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white"
          >
            {L("Compris", "Got it")}
          </button>
        </div>
      )}
    </>
  )
}