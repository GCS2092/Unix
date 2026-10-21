import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PackageIcon } from "./authIcons"
import BrandName from "./BrandName"
import { usePublicShop } from "../hooks/usePublicShop"

const linkCls = "text-muted hover:text-primary hover:underline"
const isHttp = (u: string) => /^https?:\/\//i.test(u)

type SocialKey = "facebook" | "instagram" | "tiktok"
interface Social { key: SocialKey; label: string; url: string }

function SocialIcon({ name }: { name: SocialKey }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "facebook" && <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />}
      {name === "instagram" && (
        <>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <path d="M17.5 6.5h.01" />
        </>
      )}
      {name === "tiktok" && <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />}
    </svg>
  )
}

const COLS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const

// Pied de page alimente par Parametres (Identite, Vitrine, Contact et retrait)
export default function Footer() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data: s } = usePublicShop()

  const wa = (s?.support_whatsapp ?? "").replace(/\D/g, "")
  const email = s ? s.support_email || s.legal_email : ""
  const phone = s?.legal_phone ?? ""
  const terms = s && isHttp(s.terms_url) ? s.terms_url : ""
  const socials: Social[] = s
    ? ([
        { key: "facebook", label: "Facebook", url: s.social_facebook },
        { key: "instagram", label: "Instagram", url: s.social_instagram },
        { key: "tiktok", label: "TikTok", url: s.social_tiktok },
      ] as Social[]).filter((x) => x.url && isHttp(x.url))
    : []

  const hasContact = Boolean(email || wa || phone)
  const hasFollow = socials.length > 0 || Boolean(terms)
  const cols = (1 + (hasContact ? 1 : 0) + (hasFollow ? 1 : 0)) as 1 | 2 | 3

  return (
    <footer className="border-t border-line bg-surface text-sm">
      {s && (
        <div className={`mx-auto grid max-w-6xl gap-8 px-4 py-8 ${COLS[cols]}`}>
          <div className="space-y-1">
            <p className="font-semibold">{s.legal_name || s.shop_name}</p>
            {s.legal_address && <p className="text-muted">{s.legal_address}</p>}
            {s.opening_hours && <p className="text-muted">{s.opening_hours}</p>}
          </div>

          {hasContact && (
            <div className="space-y-1">
              <p className="font-semibold">Contact</p>
              {email && <p><a className={linkCls} href={`mailto:${email}`}>{email}</a></p>}
              {wa && <p><a className={linkCls} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp {s.support_whatsapp}</a></p>}
              {phone && <p><a className={linkCls} href={`tel:${phone}`}>{phone}</a></p>}
            </div>
          )}

          {hasFollow && (
            <div className="space-y-3">
              {socials.length > 0 && (
                <>
                  <p className="font-semibold">{fr ? "Suivez-nous" : "Follow us"}</p>
                  <div className="flex gap-2">
                    {socials.map((x) => (
                      <a
                        key={x.key}
                        href={x.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={x.label}
                        title={x.label}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition hover:border-primary hover:text-primary active:scale-95"
                      >
                        <SocialIcon name={x.key} />
                      </a>
                    ))}
                  </div>
                </>
              )}
              {terms && (
                <p>
                  <a className={linkCls} href={terms} target="_blank" rel="noopener noreferrer">
                    {fr ? "Conditions générales de vente" : "Terms of sale"}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`py-6 text-center text-muted ${s ? "border-t border-line" : ""}`}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center gap-2">
            <Link
            to="/suivi"
            data-tour="track"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <PackageIcon small />
            {fr ? "Suivre ma commande" : "Track my order"}
          </Link>
            <Link
              to="/a-propos"
              data-tour="about"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              {fr ? "\u00c0 propos" : "About"}
            </Link>
          </div>
          <p className="mt-3"><Link to="/faq" className={linkCls}>FAQ</Link></p>
          <p className="mt-4">&copy; {new Date().getFullYear()} <BrandName /></p>
        </div>
      </div>
    </footer>
  )
}