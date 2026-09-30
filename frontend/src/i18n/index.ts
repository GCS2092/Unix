import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import fr from "./locales/fr.json"
import en from "./locales/en.json"
import frUx from "./locales/fr.ux.json"
import enUx from "./locales/en.ux.json"
import frCo from "./locales/fr.checkout.json"
import enCo from "./locales/en.checkout.json"

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: { ...fr, ...frUx, ...frCo } },
      en: { translation: { ...en, ...enUx, ...enCo } },
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  })

const syncHtmlLang = (l: string) => { document.documentElement.lang = l.slice(0, 2) }
syncHtmlLang(i18n.language)
i18n.on("languageChanged", syncHtmlLang)

export default i18n