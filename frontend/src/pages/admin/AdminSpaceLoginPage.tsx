import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../../components/PortalLogin"
import { adminPaths, canAccessSpace } from "../../lib/adminPaths"

export default function AdminSpaceLoginPage({ space }: { space: "shop" | "formation" }) {
  const { t } = useTranslation()
  const label = space === "shop" ? "Boutique" : "Formation"
  const home = space === "shop" ? adminPaths.shop.base : adminPaths.formation.base
  return (
    <PortalLogin
      brand={`${t("px.portal.admin_brand")} · ${label}`}
      title={t("px.portal.admin_title")}
      subtitle={t("px.portal.admin_subtitle")}
      home={home}
      allow={(u) => canAccessSpace(u, space)}
      denied={t("px.portal.admin_denied")}
      logoutLabel={t("px.portal.logout")}
      footer={<p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link></p>}
    />
  )
}