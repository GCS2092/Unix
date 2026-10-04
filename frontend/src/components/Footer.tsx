import { useTranslation } from "react-i18next"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { useAuthStore } from "../stores/authStore"

export default function Footer() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const canLearn = !!(user?.is_student || user?.is_admin)

  const learnMessage = user
    ? t("learn.wa_request_user", {
        defaultValue: "Bonjour, je souhaite acc\u00e9der aux formations. Mon e-mail : {{email}}",
        email: user.email,
      })
    : t("learn.wa_request", { defaultValue: "Bonjour, je souhaite acc\u00e9der aux formations." })

  return (
    <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4">
        {WHATSAPP_NUMBER && (
          <a
            href={whatsappUrl(t("ux.wa_hello"))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366] bg-[#25D366]/5 px-5 text-sm font-semibold text-[#0f6b4a] shadow-sm transition hover:bg-[#25D366]/15 active:scale-95"
          >
            {t("ux.wa_contact")} <span aria-hidden="true">&rarr;</span>
          </a>
        )}
        {WHATSAPP_NUMBER && !canLearn && (
          <a
            href={whatsappUrl(learnMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366] bg-[#25D366]/5 px-5 text-sm font-semibold text-[#0f6b4a] shadow-sm transition hover:bg-[#25D366]/15 active:scale-95"
          >
            {t("learn.wa_link", { defaultValue: "Acc\u00e9der aux formations ? Contactez-nous" })} <span aria-hidden="true">&rarr;</span>
          </a>
        )}
        <p>&copy; {new Date().getFullYear()} UNIX &mdash; {t("footer.shop")}</p>
      </div>
    </footer>
  )
}