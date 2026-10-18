import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import BrandName from "../components/BrandName"
import { buttonClass } from "../components/buttonStyles"
import { usePublicShop } from "../hooks/usePublicShop"
import { aboutApi, EXTRA_LINKS } from "../api/about"

const isHttp = (u: string) => /^https?:\/\//i.test(u)

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function SocialIcon({ name, label }: { name: string; label: string }) {
  if (name === "facebook") return <Svg><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></Svg>
  if (name === "instagram") return <Svg><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><path d="M17.5 6.5h.01" /></Svg>
  if (name === "tiktok") return <Svg><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></Svg>
  return <span className="text-sm font-bold">{label.charAt(0)}</span>
}

const ICON = {
  shop: "M6 7h12l-1 13H7L6 7zM9 7a3 3 0 016 0",
  learn: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 21h15",
  help: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
}

function Badge({ d }: { d: string }) {
  return (
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary-dark">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </div>
  )
}

export default function AboutPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data: shop } = usePublicShop()
  const { data: about } = useQuery({
    queryKey: ["about"],
    queryFn: async () => (await aboutApi.get()).data.data,
    staleTime: 60_000,
  })

  const tagline =
    (fr ? about?.tagline_fr : about?.tagline_en)?.trim() ||
    (fr ? "Une boutique et un espace de formation, pens\u00e9s pour vous simplifier la vie." : "A shop and a learning space, built to make your life simpler.")
  const story =
    (fr ? about?.story_fr : about?.story_en)?.trim() ||
    (fr
      ? "Notre histoire est en cours de r\u00e9daction. Revenez bient\u00f4t pour d\u00e9couvrir qui nous sommes et ce qui nous motive."
      : "Our story is being written. Come back soon to find out who we are and what drives us.")

  const values = [
    { d: ICON.shop, t: fr ? "Qualit\u00e9" : "Quality", p: fr ? "Des produits soigneusement s\u00e9lectionn\u00e9s, en qui vous pouvez avoir confiance." : "Carefully selected products you can trust." },
    { d: ICON.learn, t: fr ? "Formation" : "Learning", p: fr ? "Des cours et des sessions en direct pour d\u00e9velopper vos comp\u00e9tences." : "Courses and live sessions to grow your skills." },
    { d: ICON.help, t: fr ? "Accompagnement" : "Support", p: fr ? "Une \u00e9quipe r\u00e9active, \u00e0 un message de vous." : "A responsive team, one message away." },
  ]

  const socials: { key: string; label: string; url: string }[] = [
    { key: "facebook", label: "Facebook", url: shop?.social_facebook ?? "" },
    { key: "instagram", label: "Instagram", url: shop?.social_instagram ?? "" },
    { key: "tiktok", label: "TikTok", url: shop?.social_tiktok ?? "" },
    ...EXTRA_LINKS.map((l) => ({ key: l.key, label: l.label, url: about?.[l.key] ?? "" })),
  ].filter((x) => x.url && isHttp(x.url))

  const wa = (shop?.support_whatsapp ?? "").replace(/\D/g, "")
  const email = shop ? shop.support_email || shop.legal_email : ""
  const phone = shop?.legal_phone ?? ""
  const hasContact = Boolean(email || wa || phone || shop?.legal_address || shop?.opening_hours)
  const linkCls = "text-primary hover:underline"
  const banner = about?.banner_about_url || ""

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary to-primary-dark px-6 py-12 text-center text-white shadow-card-lg sm:py-16">
        {banner && (
          <>
            <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
            <div className="absolute inset-0 bg-primary-dark/70" aria-hidden="true" />
          </>
        )}
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-white/10" />
        <h1 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
          {fr ? "\u00c0 propos de " : "About "}<BrandName />
        </h1>
        <p className="relative mx-auto mt-3 max-w-xl text-base text-white/90">{tagline}</p>
      </section>

      <section className="mx-auto max-w-3xl text-center">
        <h2 className="text-xl font-bold">{fr ? "Notre histoire" : "Our story"}</h2>
        <p className="mt-3 whitespace-pre-line text-muted">{story}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {values.map((v) => (
          <div key={v.t} className="rounded-card border border-line bg-surface p-5 shadow-card">
            <Badge d={v.d} />
            <h3 className="font-semibold">{v.t}</h3>
            <p className="mt-1 text-sm text-muted">{v.p}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link to="/boutique" className="group rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-card-lg">
          <h3 className="font-semibold group-hover:text-primary">{fr ? "La boutique" : "The shop"}</h3>
          <p className="mt-1 text-sm text-muted">{fr ? "D\u00e9couvrez nos produits et commandez en quelques clics." : "Browse our products and order in a few clicks."}</p>
        </Link>
        <Link to="/etudiant/catalogue" className="group rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-card-lg">
          <h3 className="font-semibold group-hover:text-primary">{fr ? "Les formations" : "Courses"}</h3>
          <p className="mt-1 text-sm text-muted">{fr ? "Apprenez \u00e0 votre rythme, avec des cours et des sessions en direct." : "Learn at your own pace with courses and live sessions."}</p>
        </Link>
      </section>

      {socials.length > 0 && (
        <section className="text-center">
          <h2 className="text-xl font-bold">{fr ? "Suivez-nous" : "Follow us"}</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {socials.map((x) => (
              <a
                key={x.key}
                href={x.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold shadow-card transition hover:border-primary hover:text-primary active:scale-95"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                  <SocialIcon name={x.key} label={x.label} />
                </span>
                {x.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {hasContact && (
        <section className="mx-auto w-full max-w-3xl rounded-card border border-line bg-surface p-5 text-center shadow-card">
          <h2 className="text-lg font-bold">Contact</h2>
          <div className="mt-3 space-y-1 text-sm">
            {shop?.legal_address && <p className="text-muted">{shop.legal_address}</p>}
            {shop?.opening_hours && <p className="text-muted">{shop.opening_hours}</p>}
            {email && <p><a className={linkCls} href={`mailto:${email}`}>{email}</a></p>}
            {wa && <p><a className={linkCls} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp {shop?.support_whatsapp}</a></p>}
            {phone && <p><a className={linkCls} href={`tel:${phone}`}>{phone}</a></p>}
          </div>
        </section>
      )}

      <section className="flex flex-wrap justify-center gap-3">
        <Link to="/boutique" className={buttonClass()}>{fr ? "Voir la boutique" : "Visit the shop"}</Link>
        <Link to="/etudiant/catalogue" className={buttonClass({ variant: "secondary" })}>{fr ? "Voir les formations" : "See courses"}</Link>
        <Link to="/suivi" className={buttonClass({ variant: "ghost" })}>{fr ? "Suivre ma commande" : "Track my order"}</Link>
      </section>
    </div>
  )
}