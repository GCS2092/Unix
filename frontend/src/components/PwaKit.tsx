import { useState, useSyncExternalStore } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useTranslation } from "react-i18next"

// L'accueil guide (onboarding) est desormais gere par TourHost.
// Ce composant ne garde que : bandeau hors ligne + mise a jour de l'application.

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

const cardCls = "fixed z-[55] rounded-card border border-line bg-surface p-4 shadow-card-lg"
const sheetPos =
  "inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-96"

export default function PwaKit() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const online = useOnline()
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
        <div role="status" data-tour-block="" className={`${cardCls} ${sheetPos}`}>
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
    </>
  )
}