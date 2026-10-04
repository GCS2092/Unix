import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../../components/PortalLogin"

export default function AdminLoginPage() {
  const { t } = useTranslation()
  return (
    <PortalLogin
      brand={t("px.portal.admin_brand")}
      title={t("px.portal.admin_title")}
      subtitle={t("px.portal.admin_subtitle")}
      home="/admin"
      allow={(u) => !!u.is_admin}
      denied={t("px.portal.admin_denied")}
      logoutLabel={t("px.portal.logout")}
      footer={<p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link></p>}
    />
  )
}