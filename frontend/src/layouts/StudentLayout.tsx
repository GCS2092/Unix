import { Suspense } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"
import PreferencesMenu from "../components/PreferencesMenu"

const T = {
  brand: "Espace \u00e9tudiant",
  dashboard: "Tableau de bord",
  catalog: "Catalogue",
  shop: "Boutique",
  admin: "Administration",
  footer: "Espace \u00e9tudiant",
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${
    isActive ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
  }`

export default function StudentLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    toast.info(t("auth.logged_out"))
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/etudiant" className="text-lg font-extrabold tracking-tight text-primary">
            UNIX <span className="text-sm font-semibold text-muted">{T.brand}</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && <span className="hidden max-w-[14rem] truncate text-xs text-muted sm:inline">{user.email}</span>}
            <button type="button" onClick={() => void handleLogout()} className="min-h-[44px] text-sm font-medium text-muted transition-colors hover:text-ink">
              {t("nav.logout")}
            </button>
            <PreferencesMenu />
          </div>
        </div>
        <nav aria-label={T.brand} className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3">
          <NavLink to="/etudiant" end className={tab}>{T.dashboard}</NavLink>
          <NavLink to="/etudiant/catalogue" className={tab}>{T.catalog}</NavLink>
          <span className="ml-auto flex items-center gap-1">
            {user?.is_admin && <Link to="/admin" className="px-3 text-sm font-medium text-muted hover:text-ink">{T.admin}</Link>}
            <Link to="/" className="px-3 text-sm font-medium text-muted hover:text-ink">{T.shop}</Link>
          </span>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoader />}>
            <div key={pathname} className="animate-fade-up"><Outlet /></div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-line bg-surface py-4 text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} UNIX &mdash; {T.footer}
      </footer>
    </div>
  )
}