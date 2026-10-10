import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PackageIcon } from "./authIcons"

export default function Footer() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")

  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      <div className="mx-auto max-w-6xl px-4">
        <Link
          to="/suivi"
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10"
        >
          <PackageIcon small />
          {fr ? "Suivre ma commande" : "Track my order"}
        </Link>
        <p className="mt-4">&copy; {new Date().getFullYear()} UNIX &mdash; {t("footer.shop")}</p>
      </div>
    </footer>
  )
}