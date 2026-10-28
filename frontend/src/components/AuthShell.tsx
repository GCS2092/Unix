import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../api/client"
import BrandLogo from "./BrandLogo"

type About = {
  tagline_fr?: string
  tagline_en?: string
  story_fr?: string
  story_en?: string
  banner_about_url?: string
  banner_about_hidden?: boolean
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  )
}

// Mise en page commune des pages d'authentification : marque a gauche, formulaire a droite
export default function AuthShell({
  icon,
  title,
  subtitle,
  children,
  below,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  below?: ReactNode
}) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")

  const about = useQuery({
    queryKey: ["auth-about"],
    queryFn: async () => (await apiClient.get<{ data: About }>("/public/about")).data.data ?? {},
    staleTime: 5 * 60_000,
    retry: 0,
  })
  const a = about.data
  const tagline = ((fr ? a?.tagline_fr : a?.tagline_en) || "").trim() ||
    (fr ? "Votre boutique et vos formations, au m\u00eame endroit." : "Your shop and your courses, in one place.")
  const story = ((fr ? a?.story_fr : a?.story_en) || "").trim() ||
    (fr
      ? "Des produits s\u00e9lectionn\u00e9s avec soin, des formations pour progresser et un suivi simple de chacune de vos commandes."
      : "Carefully selected products, courses to help you grow, and simple tracking for every order.")
  const banner = a?.banner_about_url && !a.banner_about_hidden ? a.banner_about_url : null

  const points = fr
    ? ["Boutique en ligne et livraison suivie", "Formations avec certificat", "Paiement simple et s\u00e9curis\u00e9"]
    : ["Online shop with tracked delivery", "Courses with certificates", "Simple and secure payment"]

  return (
    <div className="mx-auto w-full max-w-5xl px-0 py-4 sm:py-8">
      <div className="grid overflow-hidden rounded-card border border-line bg-surface shadow-card-lg lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-primary-dark p-10 text-white lg:flex">
          {banner && <img src={banner} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-luminosity" />}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />

          <div className="relative text-3xl font-extrabold tracking-tight">
            <BrandLogo onDark />
          </div>

          <div className="relative">
            <h2 className="font-display text-3xl font-bold leading-tight">{tagline}</h2>
            <p className="mt-4 line-clamp-6 max-w-md text-base leading-relaxed text-white/85">{story}</p>
            <ul className="mt-8 space-y-3 text-sm font-medium">
              {points.map((x) => (
                <li key={x} className="flex items-center gap-3"><Check />{x}</li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/60">&copy; {new Date().getFullYear()}</p>
        </aside>

        <section className="p-6 sm:p-10">
          <div className="-mx-6 -mt-6 mb-6 bg-gradient-to-br from-primary to-primary-dark px-6 py-5 text-white sm:-mx-10 sm:-mt-10 sm:mb-8 sm:px-10 lg:hidden">
            <div className="text-xl font-extrabold tracking-tight"><BrandLogo onDark /></div>
            <p className="mt-1 text-sm text-white/85">{tagline}</p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 text-center lg:text-left">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary lg:mx-0">{icon}</div>
              <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{title}</h1>
              {subtitle && <p className="mx-auto mt-2 max-w-xs text-sm text-muted lg:mx-0">{subtitle}</p>}
            </div>

            <div>{children}</div>

            {below && <div className="mt-6 space-y-4">{below}</div>}
          </div>
        </section>
      </div>
    </div>
  )
}