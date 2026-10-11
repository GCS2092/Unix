import { useTranslation } from "react-i18next"
import { usePublicShop } from "../hooks/usePublicShop"

const link = "text-muted hover:text-primary hover:underline"

// Pied de page alimente par Parametres > Boutique et Communications
export default function SiteFooter() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data: s } = usePublicShop()
  if (!s) return null

  const wa = s.support_whatsapp.replace(/\D/g, "")
  const socials = [
    ["Facebook", s.social_facebook],
    ["Instagram", s.social_instagram],
    ["TikTok", s.social_tiktok],
  ].filter(([, url]) => url)

  return (
    <footer className="mt-12 border-t border-line py-8 text-sm">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="font-semibold">{s.legal_name || s.shop_name}</p>
          {s.legal_address && <p className="text-muted">{s.legal_address}</p>}
          {s.opening_hours && <p className="text-muted">{s.opening_hours}</p>}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{fr ? "Contact" : "Contact"}</p>
          {(s.support_email || s.legal_email) && (
            <p><a className={link} href={`mailto:${s.support_email || s.legal_email}`}>{s.support_email || s.legal_email}</a></p>
          )}
          {wa && <p><a className={link} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp {s.support_whatsapp}</a></p>}
          {s.legal_phone && <p><a className={link} href={`tel:${s.legal_phone}`}>{s.legal_phone}</a></p>}
        </div>
        <div className="space-y-1">
          {socials.length > 0 && <p className="font-semibold">{fr ? "Suivez-nous" : "Follow us"}</p>}
          {socials.map(([name, url]) => (
            <p key={name}><a className={link} href={url} target="_blank" rel="noopener noreferrer">{name}</a></p>
          ))}
          {s.terms_url && <p><a className={link} href={s.terms_url} target="_blank" rel="noopener noreferrer">{fr ? "Conditions générales de vente" : "Terms of sale"}</a></p>}
        </div>
      </div>
    </footer>
  )
}