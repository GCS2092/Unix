import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { normalizePresentation, presentationApi, type PItem, type PresentationSpace } from "../api/presentation"
import { coursesApi } from "../api/courses"
import { catalogApi } from "../api/catalog"
import { faqApi } from "../api/faq"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import PageLoader from "../components/PageLoader"
import Gallery from "../components/Gallery"
import Mosaic from "../components/Mosaic"
import WhatsAppFab from "../components/WhatsAppFab"
import PublicHeader from "../components/PublicHeader"
import { usePageTitle } from "../hooks/usePageTitle"
import Footer from "../components/Footer"
import PublicBottomNav from "../components/PublicBottomNav"

const isHttp = (u: string) => /^https?:\/\//i.test(u)

/** Lit le premier champ texte non vide parmi plusieurs noms possibles (le type du catalogue n'est pas garanti). */
function str(o: unknown, ...keys: string[]): string {
  const r = (o ?? {}) as Record<string, unknown>
  for (const k of keys) {
    const v = r[k]
    if (typeof v === "string" && v.trim() !== "") return v
  }
  return ""
}

const load = (s: PresentationSpace) => async () => normalizePresentation((await presentationApi.publicGet(s)).data.data)

export default function PresentationPage({ space }: { space: PresentationSpace }) {
  const { i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const home = space === "home"
  const shop = space === "shop"
  const tx = (fr: string, e: string) => (en ? e : fr)
  usePageTitle(space === "home" ? tx("Qui sommes-nous", "About us") : space === "shop" ? tx("Découvrir la boutique", "Discover the shop") : tx("Nos formations", "Our courses"))
  const pick = (fr: string, e: string) => (en && e.trim() ? e : fr)
  const faqSpace = space === "formation" ? "formation" : "shop"

  const page = useQuery({ queryKey: ["presentation", space], queryFn: load(space), retry: false })
  const shopCard = useQuery({ queryKey: ["presentation", "shop"], queryFn: load("shop"), retry: false, enabled: home })
  const formCard = useQuery({ queryKey: ["presentation", "formation"], queryFn: load("formation"), retry: false, enabled: home })
  const c = page.data

  // Images réelles pour les cartes de la page d'accueil (si aucune image d'en-tête n'est définie)
  const shopPics = useQuery({
    queryKey: ["mosaic", "shop"],
    queryFn: async () => {
      const rows = (await catalogApi.products({ page: 1, sort: "new" })).data.data.slice(0, 8)
      return rows
        .map((p) => (p as unknown as { thumbs?: string[] }).thumbs?.[0] ?? p.image_url ?? "")
        .filter(Boolean)
        .slice(0, 4)
    },
    enabled: home,
    retry: false,
    staleTime: 300_000,
  })
  const coursePics = useQuery({
    queryKey: ["mosaic", "formation"],
    queryFn: async () =>
      (await coursesApi.catalog()).data.data.map((x) => x.image_url ?? "").filter(Boolean).slice(0, 4),
    enabled: home,
    retry: false,
    staleTime: 300_000,
  })
  const mosaic: Record<string, string[]> = { shop: shopPics.data ?? [], formation: coursePics.data ?? [] }

  const courses = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => (await coursesApi.catalog()).data.data,
    enabled: space === "formation" && Boolean(c?.show_courses),
  })
  const faqs = useQuery({
    queryKey: ["faqs", faqSpace],
    queryFn: async () => (await faqApi.publicList(faqSpace)).data.data,
    enabled: !home && Boolean(c?.show_faq),
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

  const waMessage = home
    ? tx("Bonjour, j'ai une question.", "Hello, I have a question.")
    : shop
      ? tx("Bonjour, j'ai une question sur la boutique.", "Hello, I have a question about the shop.")
      : tx("Bonjour, j'ai une question sur vos formations.", "Hello, I have a question about your courses.")
  const contactHref = WHATSAPP_NUMBER ? whatsappUrl(waMessage) : "#contact"

  const primaryTo = shop || home ? "/boutique" : "/formations/inscription"
  const primaryLabel = shop || home ? tx("Voir la boutique", "Visit the shop") : tx("Je m'inscris", "Sign me up")
  const faqTo = shop ? "/faq" : "/formations/faq"

  const address = pick(c.location_address_fr, c.location_address_en)
  const hours = pick(c.location_hours_fr, c.location_hours_en)
  const hasLocation = Boolean(c.location_name || address || hours || isHttp(c.location_map_url))
  const hasContact = Boolean(WHATSAPP_NUMBER || c.contact_phone || c.contact_email)
  const faqRows = (faqs.data ?? []).slice(0, 5)
  const courseRows = (courses.data ?? []).slice(0, 9)
  const story = pick(c.intro_fr, c.intro_en)
  const storyTitle = pick(c.intro_title_fr, c.intro_title_en) || tx("Notre histoire", "Our story")

  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition active:scale-95"
  const Title = ({ children }: { children: string }) => <h2 className="text-xl font-bold sm:text-2xl">{children}</h2>
  const Items = ({ list, numbered }: { list: PItem[]; numbered?: boolean }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((it, i) => (
        <div key={i} className="space-y-2 rounded-card border border-line bg-surface p-4 shadow-card">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{numbered ? i + 1 : "✓"}</span>
          <h3 className="font-semibold">{pick(it.title_fr, it.title_en)}</h3>
          <p className="text-sm text-muted">{pick(it.text_fr, it.text_en)}</p>
        </div>
      ))}
    </div>
  )

  const sectionCards = [
    {
      id: "shop", data: shopCard.data, ok: !shopCard.isError,
      fbTitle: tx("Notre boutique", "Our shop"), fbSub: tx("Découvrez nos produits.", "Discover our products."),
      more: "/decouvrir/boutique", cta: "/boutique", ctaLabel: tx("Voir la boutique", "Visit the shop"),
    },
    {
      id: "formation", data: formCard.data, ok: !formCard.isError,
      fbTitle: tx("Nos formations", "Our courses"), fbSub: tx("Apprenez avec nous.", "Learn with us."),
      more: "/decouvrir/formations", cta: "/formations/inscription", ctaLabel: tx("Je m'inscris", "Sign me up"),
    },
  ].filter((x) => x.ok)

  return (
    <div className="min-h-screen bg-page">
      <PublicHeader />

      <section
        className="relative isolate overflow-hidden bg-gradient-to-br from-primary to-primary-dark text-white"
        style={c.hero_image_url ? { backgroundImage: `url("${c.hero_image_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {c.hero_image_url && <div className="absolute inset-0 bg-black/55" aria-hidden="true" />}
        <div className="relative mx-auto max-w-4xl space-y-5 px-4 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{pick(c.hero_title_fr, c.hero_title_en)}</h1>
          {(c.hero_subtitle_fr || c.hero_subtitle_en) && (
            <p className="mx-auto max-w-xl text-base text-white/90 sm:text-lg">{pick(c.hero_subtitle_fr, c.hero_subtitle_en)}</p>
          )}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to={primaryTo} className={`${btn} bg-white text-primary shadow-sm hover:bg-white/90`}>{primaryLabel}</Link>
            {home ? (
              <Link to="/decouvrir/formations" className={`${btn} border border-white/60 text-white hover:bg-white/10`}>
                {tx("Voir les formations", "See the courses")}
              </Link>
            ) : (
              <a
                href={contactHref}
                {...(WHATSAPP_NUMBER ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`${btn} border border-white/60 text-white hover:bg-white/10`}
              >
                {tx("Nous contacter", "Contact us")}
              </a>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12">
        {story && (
          <section className={`grid items-center gap-6 ${c.story_image_url ? "md:grid-cols-2" : ""}`}>
            <div className="space-y-3">
              <Title>{storyTitle}</Title>
              <p className="whitespace-pre-line text-base leading-relaxed text-muted">{story}</p>
            </div>
            {c.story_image_url && (
              <img src={c.story_image_url} alt="" loading="lazy" className="h-64 w-full rounded-card object-cover shadow-card sm:h-80" />
            )}
          </section>
        )}

        {home && sectionCards.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Nos deux univers", "Our two worlds")}</Title>
            <div className="grid gap-4 md:grid-cols-2">
              {sectionCards.map((x) => (
                <article key={x.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                  <Mosaic urls={x.data?.hero_image_url ? [x.data.hero_image_url] : (mosaic[x.id] ?? [])} kind={x.id} />
                  <div className="space-y-3 p-5">
                    <h3 className="text-lg font-bold">{x.data ? pick(x.data.hero_title_fr, x.data.hero_title_en) : x.fbTitle}</h3>
                    <p className="text-sm text-muted">{x.data ? pick(x.data.hero_subtitle_fr, x.data.hero_subtitle_en) : x.fbSub}</p>
                    <div className="flex flex-wrap gap-2">
                      <Link to={x.cta} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>{x.ctaLabel}</Link>
                      <Link to={x.more} className={`${btn} border border-line hover:bg-black/5`}>{tx("En savoir plus", "Learn more")}</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {c.steps.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Comment ça se passe", "How it works")}</Title>
            <Items list={c.steps} numbered />
          </section>
        )}

        {c.advantages.length > 0 && (
          <section className="space-y-4">
            <Title>{home ? tx("Nos valeurs", "Our values") : tx("Pourquoi nous choisir", "Why choose us")}</Title>
            <Items list={c.advantages} />
          </section>
        )}

        {space === "formation" && c.show_courses && courseRows.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("Nos formations", "Our courses")}</Title>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courseRows.map((x) => {
                const img = str(x, "image_url", "cover_url", "thumbnail_url", "thumbnail", "image", "cover")
                const desc = str(x, "summary", "short_description", "description")
                return (
                  <Link key={x.id} to={`/formations/${x.slug}`}
                    className="group overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:border-primary">
                    {img
                      ? <img src={img} alt="" loading="lazy" className="h-40 w-full object-cover" />
                      : <div className="h-40 w-full bg-gradient-to-br from-primary/80 to-primary-dark" aria-hidden="true" />}
                    <div className="space-y-1.5 p-4">
                      <h3 className="font-semibold group-hover:text-primary">{x.title}</h3>
                      {desc && <p className="line-clamp-3 text-sm text-muted">{desc}</p>}
                      {(x.teacher || (x.duration_seconds ?? 0) > 0) && (
                        <p className="text-xs text-muted">
                          {[x.teacher, (x.duration_seconds ?? 0) > 0 ? `${Math.max(1, Math.round((x.duration_seconds ?? 0) / 60))} min` : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <span className="inline-block pt-1 text-sm font-semibold text-primary">{tx("Voir la formation", "View the course")} →</span>
                    </div>
                  </Link>
                )
              })}
            </div>
            <Link to="/etudiant/catalogue" className="inline-block text-sm font-semibold text-primary hover:underline">
              {tx("Voir tout le catalogue", "See the full catalogue")} →
            </Link>
          </section>
        )}

        {c.gallery_urls.length > 0 && (
          <section className="space-y-4">
            <Title>{tx("En images", "In pictures")}</Title>
            <Gallery images={c.gallery_urls} alt={tx("En images", "In pictures")} ratio="aspect-[4/3]" />
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

        {!home && c.show_faq && faqRows.length > 0 && (
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
            {home
              ? tx("Une question ? Parlons-en", "A question? Let's talk")
              : shop
                ? tx("Une question ? Une commande à passer ?", "A question? Ready to order?")
                : tx("Prêt à vous inscrire ?", "Ready to sign up?")}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={primaryTo} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>{primaryLabel}</Link>
            {home && (
              <Link to="/formations/inscription" className={`${btn} border border-line hover:bg-black/5`}>{tx("Je m'inscris à une formation", "Sign up for a course")}</Link>
            )}
            {WHATSAPP_NUMBER && (
              <a href={whatsappUrl(waMessage)} target="_blank" rel="noopener noreferrer"
                className={`${btn} border border-[#25D366] text-[#0f6b4a] hover:bg-[#25D366]/10`}>
                {tx("Écrire sur WhatsApp", "Message us on WhatsApp")}
              </a>
            )}
            {c.contact_phone && (
              <a href={`tel:${c.contact_phone.replace(/[^\d+]/g, "")}`} className={`${btn} border border-line hover:bg-black/5`}>{c.contact_phone}</a>
            )}
            {c.contact_email && (
              <a href={`mailto:${c.contact_email}`} className={`${btn} border border-line hover:bg-black/5`}>{c.contact_email}</a>
            )}
          </div>
          {!hasContact && <p className="text-xs text-muted">{tx("Coordonnées bientôt disponibles.", "Contact details coming soon.")}</p>}
        </section>

        {!home && (
          <p className="text-center text-sm">
            <Link to={shop ? "/decouvrir/formations" : "/decouvrir/boutique"} className="font-semibold text-primary hover:underline">
              {shop ? tx("Découvrir nos formations", "Discover our courses") : tx("Découvrir la boutique", "Discover the shop")} →
            </Link>
          </p>
        )}
      </main>
      <div className="bg-surface pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"><Footer /></div>
      <PublicBottomNav />
      <WhatsAppFab />
    </div>
  )
}