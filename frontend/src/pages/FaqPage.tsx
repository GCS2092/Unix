import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { FaqSpace } from "../api/faq"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import WhatsAppFab from "../components/WhatsAppFab"
import PublicHeader from "../components/PublicHeader"
import FaqAccordion from "../components/FaqAccordion"
import { usePageTitle } from "../hooks/usePageTitle"
import Footer from "../components/Footer"
import PublicBottomNav from "../components/PublicBottomNav"

export default function FaqPage({ space }: { space: FaqSpace }) {
  const { t, i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const shop = space === "shop"
  usePageTitle(shop ? (en ? "Shop FAQ" : "FAQ boutique") : (en ? "Courses FAQ" : "FAQ formations"))

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

        <FaqAccordion space={space} />

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