import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      © {new Date().getFullYear()} UNIX — {t("footer.shop")}
    </footer>
  )
}