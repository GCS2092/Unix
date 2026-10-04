import { Link } from "react-router-dom"
import PortalLogin from "../components/PortalLogin"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

const T = {
  brand: "Espace \u00e9tudiant",
  title: "Connexion \u00e9tudiant",
  subtitle: "Retrouvez vos formations, votre progression et vos certificats.",
  denied: "Ce compte n'a pas encore acc\u00e8s aux formations. Contactez-nous pour l'activer.",
  logout: "Se d\u00e9connecter",
  askAccess: "Pas encore d'acc\u00e8s ? Demandez-le-nous",
  waMessage: "Bonjour, je souhaite acc\u00e9der aux formations.",
  shop: "Retour \u00e0 la boutique",
}

export default function StudentLoginPage() {
  return (
    <PortalLogin
      brand={T.brand}
      title={T.title}
      subtitle={T.subtitle}
      home="/etudiant"
      allow={(u) => !!(u.is_student || u.is_admin)}
      denied={T.denied}
      logoutLabel={T.logout}
      footer={
        <>
          {WHATSAPP_NUMBER && (
            <p>
              <a href={whatsappUrl(T.waMessage)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {T.askAccess}
              </a>
            </p>
          )}
          <p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link></p>
        </>
      }
    />
  )
}