import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useKeyboardOpen } from "../hooks/useKeyboardOpen"

const ICON = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  shop: "M6 7h12l-1 13H7L6 7zM9 7a3 3 0 016 0",
  courses: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 21h15",
  faq: "M12 17h.01M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4M12 21a9 9 0 100-18 9 9 0 000 18z",
  signup: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6",
}

/** Barre du bas des pages de presentation : meme style que la boutique, boutons adaptes aux visiteurs. */
export default function PublicBottomNav() {
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const fr = (i18n.language || "fr").startsWith("fr")
  const formationSide = pathname.startsWith("/formations") || pathname.startsWith("/decouvrir/formations")

  const typing = useKeyboardOpen()

  const items = [
    { key: "home", to: "/decouvrir", label: fr ? "Accueil" : "Home", icon: ICON.home, active: pathname === "/decouvrir" },
    { key: "shop", to: "/decouvrir/boutique", label: fr ? "Boutique" : "Shop", icon: ICON.shop, active: pathname === "/decouvrir/boutique" },
    { key: "courses", to: "/decouvrir/formations", label: fr ? "Formations" : "Courses", icon: ICON.courses, active: pathname === "/decouvrir/formations" },
    { key: "faq", to: formationSide ? "/formations/faq" : "/faq", label: "FAQ", icon: ICON.faq, active: pathname.endsWith("/faq") },
    { key: "signup", to: "/formations/inscription", label: fr ? "S'inscrire" : "Sign up", icon: ICON.signup, active: pathname === "/formations/inscription" },
  ]

  return (
    <nav
      aria-label={fr ? "Navigation" : "Navigation"}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] transition-transform duration-200 md:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {items.map((it) => (
          <li key={it.key} className="relative">
            {it.active && <span aria-hidden="true" className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />}
            <Link
              to={it.to}
              aria-current={it.active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-95 ${
                it.active ? "text-primary" : "text-muted"
              }`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${it.active ? "bg-primary/10" : ""}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={it.icon} />
                </svg>
              </span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}