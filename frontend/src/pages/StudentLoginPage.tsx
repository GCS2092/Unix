import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../components/PortalLogin"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

export default function StudentLoginPage() {
  const { t } = useTranslation()
  return (
    <PortalLogin
      brand={t("px.portal.student_brand")}
      title={t("px.portal.student_title")}
      subtitle={t("px.portal.student_subtitle")}
      home="/etudiant"
      allow={(u) => !!(u.is_student || u.is_admin)}
      denied={t("px.portal.student_denied")}
      logoutLabel={t("px.portal.logout")}
      footer={
        <>
          {WHATSAPP_NUMBER && (
            <p>
              <a href={whatsappUrl(t("px.portal.wa_message"))} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {t("px.portal.ask_access")}
              </a>
            </p>
          )}
          <p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link></p>
        </>
      }
    />
  )
}