import { useTranslation } from "react-i18next"
import CommunicationSettingsForm from "./CommunicationSettingsForm"

/** Qui re\u00e7oit quelles alertes e-mail (commande pay\u00e9e, conflit de stock). Section 5 du formulaire de communication. */
export default function AdminAlertRecipientsPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold sm:text-2xl">{fr ? "Notifications \u00e9quipe" : "Team notifications"}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">
        {fr
          ? "Choisissez qui re\u00e7oit chaque alerte : nouvelle commande pay\u00e9e en ligne, conflit de stock."
          : "Choose who receives each alert: new order paid online, stock conflict."}
      </p>
      <CommunicationSettingsForm parts={[5]} />
    </div>
  )
}