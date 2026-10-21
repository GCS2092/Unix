import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PackageIcon } from "./authIcons"
import BrandName from "./BrandName"
import { usePublicShop } from "../hooks/usePublicShop"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"

const isHttp = (u: string) => /^https?:\/\//i.test(u)
const linkCls = "block py-2 text-sm text-muted transition hover:text-primary"
const headCls = "mb-1 text-[11px] font-medium uppercase tracking-wider text-muted/80"

type SocialKey = "facebook" | "instagram" | "tiktok" | "whatsapp"
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
      {name === "whatsapp" && <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />}
    </svg>
  )
}

function MiniIcon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const PIN = "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
const PHONE = "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
const MAIL = "M3 6h18v12H3zM3 7l9 6 9-6"

// Pied de page alimente par Parametres (Identite, Vitrine, Contact et retrait)
export default function Footer() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data: s } = usePublicShop()

  const wa = (s?.support_whatsapp ?? "").replace(/\D/g, "") || WHATSAPP_NUMBER
  const email = s ? s.support_email || s.legal_email : ""
  const phone = s?.legal_phone || s?.support_whatsapp || ""
  const address = s?.legal_address ?? ""
  const hours = s?.opening_hours ?? ""
  const terms = s && isHttp(s.terms_url) ? s.terms_url : ""
  const name = s ? s.legal_name || s.shop_name : ""

  const socials: Social[] = [
    ...(s
      ? ([
          { key: "facebook", label: "Facebook", url: s.social_facebook },
          { key: "instagram", label: "Instagram", url: s.social_instagram },
          { key: "tiktok", label: "TikTok", url: s.social_tiktok },
        ] as Social[]).filter((x) => x.url && isHttp(x.url))
      : []),
    ...(wa ? [{ key: "whatsapp", label: "WhatsApp", url: `https://wa.me/${wa}` } as Social] : []),
  ]

  const hasInfo = Boolean(address || phone || email || hours)

  return (
    <footer className="border-t border-line bg-surface text-sm">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-6 pt-8 md:grid-cols-[1.2fr_2fr] md:gap-12">
        <div className="space-y-4 text-center md:text-left">
          <div>
            <p className="text-xl font-extrabold tracking-tight text-primary">{name || <BrandName />}</p>
            <p className="mt-1 text-sm text-muted">{fr ? "Boutique et formations" : "Shop and courses"}</p>
          </div>

          {socials.length > 0 && (
            <div className="flex justify-center gap-3 md:justify-start">
              {socials.map((x) => (
                <a
                  key={x.key}
                  href={x.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={x.label}
                  title={x.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition active:scale-95 ${
                    x.key === "whatsapp"
                      ? "border-[#25D366]/50 bg-[#25D366]/10 text-[#0f6b4a] hover:bg-[#25D366]/20"
                      : "border-line text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  <SocialIcon name={x.key} />
                </a>
              ))}
            </div>
          )}

          <Link
            to="/suivi"
            data-tour="track"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark active:scale-95 md:w-auto"
          >
            <PackageIcon small />
            {fr ? "Suivre ma commande" : "Track my order"}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-card bg-page px-4 py-4 md:gap-8 md:bg-transparent md:p-0">
          <nav aria-label={fr ? "Boutique" : "Shop"}>
            <p className={headCls}>{fr ? "Boutique" : "Shop"}</p>
            <Link to="/decouvrir/boutique" className={linkCls}>{fr ? "Découvrir la boutique" : "Discover the shop"}</Link>
            <Link to="/faq" className={linkCls}>{fr ? "FAQ boutique" : "Shop FAQ"}</Link>
            <Link to="/decouvrir" data-tour="about" className={linkCls}>{fr ? "Qui sommes-nous" : "About us"}</Link>
          </nav>
          <nav aria-label={fr ? "Formations" : "Courses"}>
            <p className={headCls}>{fr ? "Formations" : "Courses"}</p>
            <Link to="/decouvrir/formations" className={linkCls}>{fr ? "Nos formations" : "Our courses"}</Link>
            <Link to="/formations/inscription" className={linkCls}>{fr ? "S'inscrire" : "Sign up"}</Link>
            <Link to="/formations/faq" className={linkCls}>{fr ? "FAQ formations" : "Courses FAQ"}</Link>
          </nav>
        </div>
      </div>

      <div data-footer-cta="true" className="mx-auto flex max-w-5xl gap-3 px-4 pb-6 md:justify-center">
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(fr ? "Bonjour, j'ai une question." : "Hello, I have a question.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#25D366] px-3 text-center text-sm font-semibold text-[#0f6b4a] transition hover:bg-[#25D366]/10 active:scale-95 md:max-w-[240px]"
          >
            <SocialIcon name="whatsapp" />
            {fr ? "Nous contacter" : "Contact us"}
          </a>
        )}
        <Link
          to="/formations/inscription"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 text-center text-sm font-semibold text-primary transition hover:bg-primary/5 active:scale-95 md:max-w-[240px]"
        >
          <MiniIcon d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5" />
          {fr ? "S'inscrire à une formation" : "Sign up for a course"}
        </Link>
      </div>

      <div className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 md:flex-row md:justify-between">
          {hasInfo && (
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
              {address && <span className="inline-flex items-center gap-1.5"><MiniIcon d={PIN} />{address}</span>}
              {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-primary"><MiniIcon d={PHONE} />{phone}</a>}
              {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><MiniIcon d={MAIL} />{email}</a>}
              {hours && <span>{hours}</span>}
            </p>
          )}
          <p>
            {terms && (
              <>
                <a href={terms} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  {fr ? "Conditions de vente" : "Terms of sale"}
                </a>
                {" · "}
              </>
            )}
            &copy; {new Date().getFullYear()} <BrandName />
          </p>
        </div>
      </div>
    </footer>
  )
}