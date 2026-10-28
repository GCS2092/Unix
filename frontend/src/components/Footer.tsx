import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PackageIcon } from "./authIcons"
import BrandName from "./BrandName"
import BrandLogo from "./BrandLogo"
import { usePublicShop } from "../hooks/usePublicShop"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"

const isHttp = (u: string) => /^https?:\/\//i.test(u)
const linkCls = "block py-1.5 text-sm text-white/75 transition hover:text-white"
const headCls = "mb-2 text-xs font-semibold uppercase tracking-wider text-white/60"

type SocialKey = "facebook" | "instagram" | "tiktok" | "whatsapp"
interface Social { key: Exclude<SocialKey, "whatsapp">; label: string; url: string }

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
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const PIN = "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
const PHONE = "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
const MAIL = "M3 6h18v12H3zM3 7l9 6 9-6"
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2"
const CAP = "M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5"

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

  const socials: Social[] = s
    ? ([
        { key: "facebook", label: "Facebook", url: s.social_facebook },
        { key: "instagram", label: "Instagram", url: s.social_instagram },
        { key: "tiktok", label: "TikTok", url: s.social_tiktok },
      ] as Social[]).filter((x) => x.url && isHttp(x.url))
    : []

  const row = "flex items-start gap-2.5 text-sm text-white/75 transition hover:text-white"

  return (
    <footer className="bg-primary-dark text-sm text-white/75">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1.4fr] md:gap-x-10">
          <div className="col-span-2 space-y-4 md:col-span-1">
            <div>
              <div className="font-display text-2xl font-extrabold tracking-tight text-white"><BrandLogo onDark size="lg" label={name} /></div>
              <p className="mt-1 text-sm text-white/70">{fr ? "Boutique et formations" : "Shop and courses"}</p>
            </div>

            {socials.length > 0 && (
              <div className="flex gap-3">
                {socials.map((x) => (
                  <a
                    key={x.key}
                    href={x.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={x.label}
                    title={x.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    <SocialIcon name={x.key} />
                  </a>
                ))}
              </div>
            )}

            <Link
              to="/suivi"
              data-tour="track"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition hover:bg-accent-dark active:scale-95 sm:w-auto"
            >
              <PackageIcon small />
              {fr ? "Suivre ma commande" : "Track my order"}
            </Link>
          </div>

          <nav aria-label={fr ? "Boutique" : "Shop"}>
            <p className={headCls}>{fr ? "Boutique" : "Shop"}</p>
            <Link to="/decouvrir/boutique" className={linkCls}>{fr ? "D\u00e9couvrir la boutique" : "Discover the shop"}</Link>
            <Link to="/faq" className={linkCls}>{fr ? "FAQ boutique" : "Shop FAQ"}</Link>
            <Link to="/decouvrir" data-tour="about" className={linkCls}>{fr ? "Qui sommes-nous" : "About us"}</Link>
          </nav>

          <nav aria-label={fr ? "Formations" : "Courses"}>
            <p className={headCls}>{fr ? "Formations" : "Courses"}</p>
            <Link to="/decouvrir/formations" className={linkCls}>{fr ? "Nos formations" : "Our courses"}</Link>
            <Link to="/formations/faq" className={linkCls}>{fr ? "FAQ formations" : "Courses FAQ"}</Link>
            <Link to="/formations/inscription" className={`${linkCls} inline-flex items-center gap-2 font-semibold !text-white`}>
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CAP} /></svg>
              {fr ? "S'inscrire" : "Sign up"}
            </Link>
          </nav>

          <div className="col-span-2 md:col-span-1">
            <p className={headCls}>Contact</p>
            <ul className="space-y-2.5">
              {address && (
                <li>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className={row}>
                    <MiniIcon d={PIN} />{address}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={row}><MiniIcon d={PHONE} />{phone}</a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`} className={`${row} break-all`}><MiniIcon d={MAIL} />{email}</a>
                </li>
              )}
              {hours && (
                <li className="flex items-start gap-2.5 text-sm text-white/75"><MiniIcon d={CLOCK} />{hours}</li>
              )}
            </ul>

            {wa && (
              <div data-footer-cta="true" className="mt-4">
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(fr ? "Bonjour, j'ai une question." : "Hello, I have a question.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95 sm:w-auto"
                >
                  <SocialIcon name="whatsapp" />
                  {fr ? "Nous contacter sur WhatsApp" : "Contact us on WhatsApp"}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 pb-20 pt-4 text-xs text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {name || <BrandName />}
            {terms && (
              <>
                {" \u00b7 "}
                <a href={terms} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  {fr ? "Conditions de vente" : "Terms of sale"}
                </a>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold transition hover:text-white"
          >
            <span aria-hidden="true">{"\u2191"}</span>
            {fr ? "Retour en haut" : "Back to top"}
          </button>
        </div>
      </div>
    </footer>
  )
}