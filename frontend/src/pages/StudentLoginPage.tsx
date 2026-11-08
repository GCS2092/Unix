import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../components/PortalLogin"
import { canAccessSpace } from "../lib/adminPaths"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

// Connexion de la formation (IGA) : aucun mot sur la boutique. Un compte boutique seul est renvoye vers la boutique.
export default function StudentLoginPage() {
  const { t, i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  return (
    <PortalLogin
      brand={t("px.portal.student_brand")}
      title={t("px.portal.student_title")}
      subtitle={t("px.portal.student_subtitle")}
      home="/etudiant"
      allow={(u) => !!(u.is_student || canAccessSpace(u, "formation") || (u as { formation_signup?: boolean }).formation_signup === true)}
      denied={en ? "This account has no access to the courses: you are being redirected." : "Ce compte n'a pas accès aux formations : vous êtes redirigé vers l'espace qui lui correspond."}
      deniedTo="/"
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
          <p>
            <Link to="/formations/inscription" className="font-semibold text-primary hover:underline">
              {en ? "Not enrolled yet? Sign up for a course" : "Pas encore inscrit ? Inscrivez-vous à une formation"}
            </Link>
          </p>
        </>
      }
    />
  )
}