import { useTranslation } from "react-i18next"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4">
        {WHATSAPP_NUMBER && (
          <a
            href={whatsappUrl(t("ux.wa_hello"))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center font-medium text-[#0f6b4a] hover:underline"
          >
            {t("ux.wa_contact")}
          </a>
        )}
        <p>© {new Date().getFullYear()} UNIX — {t("footer.shop")}</p>
      </div>
    </footer>
  )
}