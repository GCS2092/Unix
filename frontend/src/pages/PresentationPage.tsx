import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { normalizePresentation, presentationApi, type PItem, type PresentationSpace } from "../api/presentation"
import { coursesApi } from "../api/courses"
import { faqApi } from "../api/faq"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import BrandName from "../components/BrandName"
import PageLoader from "../components/PageLoader"
import WhatsAppFab from "../components/WhatsAppFab"

const isHttp = (u: string) => /^https?:\/\//i.test(u)

export default function PresentationPage({ space }: { space: PresentationSpace }) {
  const { i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const shop = space === "shop"
  const tx = (fr: string, e: string) => (en ? e : fr)
  const pick = (fr: string, e: string) => (en && e.trim() ? e : fr)

  const page = useQuery({
    queryKey: ["presentation", space],
    queryFn: async () => normalizePresentation((await presentationApi.publicGet(space)).data.data),
    retry: false,
  })
  const c = page.data

  const courses = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => (await coursesApi.catalog()).data.data,
    enabled: !shop && Boolean(c?.show_courses),
  })
  const faqs = useQuery({
    queryKey: ["faqs", space],
    queryFn: async () => (await faqApi.publicList(space)).data.data,
    enabled: Boolean(c?.show_faq),
  })

  if (page.isLoading) return <PageLoader />
  if (page.isError || !c) {
    return (
      <div className="grid min-h-screen place-items-center bg-page px-4 text-center">
        <div className="space-y-3">
          <p className="text-sm text-muted">{tx("Cette page n'est pas disponible pour le moment.", "This page is not available right now.")}</p>
          <Link to="/boutique" className="font-semibold text-primary hover:underline">{tx("Retour à la boutique", "Back to the shop")}</Link>
        </div>
      </div>
    )
  }

  const waMessage = shop
    ? tx("Bonjour, j'ai une question sur la boutique.", "Hello, I have a question about the shop.")
    : tx("Bonjour, j'ai une question sur vos formations.", "Hello, I have a question about your courses.")
  const contactHref = WHATSAPP_NUMBER ? whatsappUrl(waMessage) : "#contact"
  const contactExternal = Boolean(WHATSAPP_NUMBER)

  const primaryTo = shop ? "/boutique" : "/formations/inscription"
  const primaryLabel = shop ? tx("Voir la boutique", "Visit the shop") : tx("Je m'inscris", "Sign me up")
  const faqTo = shop ? "/faq" : "/formations/faq"

  const address = pick(c.location_address_fr, c.location_address_en)
  const hours = pick(c.location_hours_fr, c.location_hours_en)
  const hasLocation = Boolean(c.location_name || address || hours || isHttp(c.location_map_url))
  const phoneHref = `tel:${c.contact_phone.replace(/[^\d+]/g, "")}`
  const hasContact = Boolean(WHATSAPP_NUMBER || c.contact_phone || c.contact_email)
  const faqRows = (faqs.data ?? []).slice(0, 5)
  const courseRows = (courses.data ?? []).slice(0, 8)

  const heroBtn = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition active:scale-95"
  const Title = ({ children }: { children: string }) => <h2 className="text-xl font-bold sm:text-2xl">{children}</h2>
  const Items = ({ list, numbered }: { list: PItem[]; numbered?: boolean }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((it, i) => (
        <div key={i} className="space-y-2 rounded-card border border-line bg-surface p-4 shadow-card">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {numbered ? i + 1 : "✓"}
          </span>
          <h3 className="font-semibold">{pick(it.title_fr, it.title_en)}</h3>
          <p className="text-sm text-muted">{pick(it.text_fr, it.text_en)}</p>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/boutique" className="text-lg font-extrabold tracking-tight text-primary"><BrandName /></Link>
          <nav className="flex gap-1.5" aria-label="Sections">
            {([["shop", "/decouvrir/boutique", tx("Boutique", "Shop")], ["formation", "/decouvrir/formations", tx("Formations", "Courses")]] as const).map(([id, to, label]) => (
              <Link
                key={id} to={to} aria-current={id === space ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  id === space ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary to-primary-dark text-white">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-14 text-center sm:py-20">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{pick(c.hero_title_fr, c.hero_title_en)}</h1>
          {(c.hero_subtitle_fr || c.hero_subtitle_en) && (
            <p className="mx-auto max-w-xl text-base text-white/90 sm:text-lg">{pick(c.hero_subtitle_fr, c.hero_subtitle_en)}</p>
          )}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to={primaryTo} className={`${heroBtn} bg-white text-primary shadow-sm hover:bg-white/90`}>{primaryLabel}</Link>
            <a
              href={contactHref}
              {...(contactExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={`${heroBtn} border border-white/60 text-white hover:bg-white/10`}
            >
              {tx("Nous contacter", "Contact us")}
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl space-y-12 px-4 py-10">
        {(c.intro_fr || c.intro_en) && (
          <p className="mx-auto max-w-2xl whitespace-pre-line text-center text-base text-muted">{pick(c.intro_fr, c.intro_en)}</p>
        )}

        {c.steps.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Comment ça se passe", "How it works")}</Title>
            <Items list={c.steps} numbered />
          </section>
        )}

        {c.advantages.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Pourquoi nous choisir", "Why choose us")}</Title>
            <Items list={c.advantages} />
          </section>
        )}

        {!shop && c.show_courses && courseRows.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Nos formations", "Our courses")}</Title>
            <div className="flex flex-wrap gap-2">
              {courseRows.map((x) => (
                <Link key={x.id} to={`/formations/${x.slug}`}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-card transition hover:border-primary hover:text-primary">
                  {x.title}
                </Link>
              ))}
            </div>
            <Link to="/etudiant/catalogue" className="inline-block text-sm font-semibold text-primary hover:underline">
              {tx("Voir tout le catalogue", "See the full catalogue")} →
            </Link>
          </section>
        )}

        {hasLocation && (
          <section className="space-y-3">
            <Title>{tx("Où nous trouver", "Where to find us")}</Title>
            <div className="space-y-1 rounded-card border border-line bg-surface p-4 shadow-card">
              {c.location_name && <p className="font-semibold">{c.location_name}</p>}
              {address && <p className="text-sm text-muted">{address}</p>}
              {hours && <p className="text-sm text-muted">{hours}</p>}
              {isHttp(c.location_map_url) && (
                <a href={c.location_map_url} target="_blank" rel="noopener noreferrer" className="inline-block pt-1 text-sm font-semibold text-primary hover:underline">
                  {tx("Voir sur la carte", "View on the map")} →
                </a>
              )}
            </div>
          </section>
        )}

        {c.show_faq && faqRows.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Questions fréquentes", "Frequently asked questions")}</Title>
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {faqRows.map((f) => (
                <details key={f.id} className="group px-4 py-3">
                  <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    <span>{en && f.question_en ? f.question_en : f.question_fr}</span>
                    <span aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted">{en && f.answer_en ? f.answer_en : f.answer_fr}</p>
                </details>
              ))}
            </div>
            <Link to={faqTo} className="inline-block text-sm font-semibold text-primary hover:underline">
              {tx("Toutes les questions", "All questions")} →
            </Link>
          </section>
        )}

        <section id="contact" className="space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <h2 className="text-xl font-bold">
            {shop ? tx("Une question ? Une commande à passer ?", "A question? Ready to order?") : tx("Prêt à vous inscrire ?", "Ready to sign up?")}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={primaryTo} className={`${heroBtn} bg-primary text-white hover:bg-primary-dark`}>{primaryLabel}</Link>
            {WHATSAPP_NUMBER && (
              <a href={whatsappUrl(waMessage)} target="_blank" rel="noopener noreferrer"
                className={`${heroBtn} border border-[#25D366] text-[#0f6b4a] hover:bg-[#25D366]/10`}>
                {tx("Écrire sur WhatsApp", "Message us on WhatsApp")}
              </a>
            )}
            {c.contact_phone && (
              <a href={phoneHref} className={`${heroBtn} border border-line hover:bg-black/5`}>{c.contact_phone}</a>
            )}
            {c.contact_email && (
              <a href={`mailto:${c.contact_email}`} className={`${heroBtn} border border-line hover:bg-black/5`}>{c.contact_email}</a>
            )}
          </div>
          {!hasContact && <p className="text-xs text-muted">{tx("Coordonnées bientôt disponibles.", "Contact details coming soon.")}</p>}
        </section>

        <p className="text-center text-sm">
          <Link
            to={shop ? "/decouvrir/formations" : "/decouvrir/boutique"}
            className="font-semibold text-primary hover:underline"
          >
            {shop ? tx("Découvrir nos formations", "Discover our courses") : tx("Découvrir la boutique", "Discover the shop")} →
          </Link>
        </p>
      </main>
      <WhatsAppFab />
    </div>
  )
}