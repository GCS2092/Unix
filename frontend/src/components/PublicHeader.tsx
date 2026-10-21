import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import BrandName from "./BrandName"
import PreferencesMenu from "./PreferencesMenu"

/** En-tete des pages de presentation : retour, logo, langue et devise ; navigation et inscription sur grand ecran. */
export default function PublicHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const tx = (fr: string, e: string) => (en ? e : fr)

  const fallback = pathname.startsWith("/formations")
    ? "/decouvrir/formations"
    : pathname === "/faq"
      ? "/decouvrir/boutique"
      : "/boutique"

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }

  const tabs = [
    { to: "/decouvrir", label: tx("Accueil", "Home") },
    { to: "/decouvrir/boutique", label: tx("Boutique", "Shop") },
    { to: "/decouvrir/formations", label: tx("Formations", "Courses") },
  ]

  const brand = "text-lg font-extrabold tracking-tight text-primary"

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-4">
        <div className="flex items-center gap-3 justify-self-start">
          <button
            type="button"
            onClick={goBack}
            aria-label={tx("Retour", "Back")}
            title={tx("Retour", "Back")}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-black/5 active:scale-95"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </button>
          <Link to="/boutique" className={`${brand} hidden md:inline`}><BrandName /></Link>
        </div>

        <div className="justify-self-center">
          <Link to="/boutique" className={`${brand} md:hidden`}><BrandName /></Link>
          <nav className="hidden gap-1.5 md:flex" aria-label={tx("Sections", "Sections")}>
            {tabs.map((x) => {
              const active = pathname === x.to
              return (
                <Link
                  key={x.to}
                  to={x.to}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {x.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <PreferencesMenu />
          {pathname !== "/formations/inscription" && (
            <Link
              to="/formations/inscription"
              className="hidden min-h-[40px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark active:scale-95 md:inline-flex"
            >
              {tx("S'inscrire", "Sign up")}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}