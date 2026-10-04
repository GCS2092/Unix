import { Link } from "react-router-dom"
import PortalLogin from "../../components/PortalLogin"

const T = {
  brand: "Administration",
  title: "Connexion administrateur",
  subtitle: "Espace r\u00e9serv\u00e9 \u00e0 l'\u00e9quipe.",
  denied: "Ce compte n'a pas les droits d'administration.",
  logout: "Se d\u00e9connecter",
  shop: "Retour \u00e0 la boutique",
}

export default function AdminLoginPage() {
  return (
    <PortalLogin
      brand={T.brand}
      title={T.title}
      subtitle={T.subtitle}
      home="/admin"
      allow={(u) => !!u.is_admin}
      denied={T.denied}
      logoutLabel={T.logout}
      footer={<p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link></p>}
    />
  )
}