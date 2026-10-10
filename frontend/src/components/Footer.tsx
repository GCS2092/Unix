import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      <div className="mx-auto max-w-6xl px-4">
        <p>&copy; {new Date().getFullYear()} UNIX &mdash; {t("footer.shop")}</p>
      </div>
    </footer>
  )
}