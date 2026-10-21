import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { faqApi, type Faq, type FaqSpace } from "../api/faq"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import WhatsAppFab from "../components/WhatsAppFab"
import PublicHeader from "../components/PublicHeader"
import { usePageTitle } from "../hooks/usePageTitle"
import Footer from "../components/Footer"
import PublicBottomNav from "../components/PublicBottomNav"

export default function FaqPage({ space }: { space: FaqSpace }) {
  const { t, i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const shop = space === "shop"
  usePageTitle(shop ? (en ? "Shop FAQ" : "FAQ boutique") : (en ? "Courses FAQ" : "FAQ formations"))
  const [q, setQ] = useState("")

  const query = useQuery({
    queryKey: ["faqs", space],
    queryFn: async () => (await faqApi.publicList(space)).data.data,
  })

  const general = t("px.faq.general", { defaultValue: "Général" })

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const map = new Map<string, { id: number; question: string; answer: string }[]>()
    for (const f of (query.data ?? []) as Faq[]) {
      const question = en && f.question_en ? f.question_en : f.question_fr
      const answer = en && f.answer_en ? f.answer_en : f.answer_fr
      const category = (en && f.category_en ? f.category_en : f.category_fr) || general
      if (needle && !`${question} ${answer}`.toLowerCase().includes(needle)) continue
      const bucket = map.get(category) ?? []
      bucket.push({ id: f.id, question, answer })
      map.set(category, bucket)
    }
    return Array.from(map.entries())
  }, [query.data, q, en, general])

  const waMessage = en
    ? "Hello, I have a question that is not in your FAQ."
    : "Bonjour, j'ai une question qui n'est pas dans votre FAQ."

  return (
    <div className="min-h-screen bg-page">
      <PublicHeader />

      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {shop
              ? t("px.faq.title_shop", { defaultValue: "Questions fréquentes : boutique" })
              : t("px.faq.title_formation", { defaultValue: "Questions fréquentes : formations" })}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {t("px.faq.subtitle", { defaultValue: "Une réponse rapide à vos questions. Vous ne trouvez pas ? Écrivez-nous." })}
          </p>
        </div>

        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t("px.faq.search", { defaultValue: "Rechercher une question..." })}
          aria-label={t("px.faq.search", { defaultValue: "Rechercher une question..." })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        {query.isLoading && <p className="text-center text-sm text-muted">{t("px.faq.loading", { defaultValue: "Chargement..." })}</p>}
        {query.isError && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">
            {t("px.faq.error", { defaultValue: "Impossible de charger la FAQ pour le moment." })}
          </p>
        )}
        {!query.isLoading && !query.isError && groups.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {q.trim()
              ? t("px.faq.none_found", { defaultValue: "Aucune question ne correspond à votre recherche." })
              : t("px.faq.none", { defaultValue: "Aucune question pour le moment." })}
          </p>
        )}

        {groups.map(([category, rows]) => (
          <section key={category} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{category}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {rows.map((r) => (
                <details key={r.id} className="group px-4 py-3" open={q.trim() !== ""}>
                  <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    <span>{r.question}</span>
                    <span aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted">{r.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="space-y-3 rounded-card border border-line bg-surface p-5 text-center shadow-card">
          <p className="text-sm font-semibold">{t("px.faq.more", { defaultValue: "Vous avez une autre question ?" })}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {WHATSAPP_NUMBER && (
              <a
                href={whatsappUrl(waMessage)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#25D366] px-4 py-2.5 text-sm font-semibold text-[#0f6b4a] transition hover:bg-[#25D366]/10"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
                </svg>
                {t("px.faq.ask", { defaultValue: "Poser une autre question" })}
              </a>
            )}
            {shop ? (
              <Link to="/boutique" className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
                {t("px.faq.shop_cta", { defaultValue: "Voir la boutique" })}
              </Link>
            ) : (
              <Link to="/formations/inscription" className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
                {t("px.faq.signup", { defaultValue: "S'inscrire à une formation" })}
              </Link>
            )}
          </div>
        </div>
      </main>
      <div className="bg-surface pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"><Footer /></div>
      <PublicBottomNav />
      <WhatsAppFab />
    </div>
  )
}