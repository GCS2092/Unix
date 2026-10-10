import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")

  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      <div className="mx-auto max-w-6xl px-4">
        <p>&copy; {new Date().getFullYear()} UNIX &mdash; {t("footer.shop")}</p>
        <p className="mt-2"><Link to="/suivi" className="font-medium text-primary hover:underline">{fr ? "Suivre ma commande" : "Track my order"}</Link></p>
      </div>
    </footer>
  )
}