import { Suspense, useState, type ReactNode } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"
import PreferencesMenu from "../components/PreferencesMenu"
import LiveBanner from "../components/LiveBanner"
import WhatsAppFab from "../components/WhatsAppFab"
import { useNotifications } from "../lib/useNotifications"

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${
    isActive ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
  }`

const action = ({ isActive }: { isActive: boolean }) =>
  `my-1.5 inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${
    isActive ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface text-ink hover:border-primary hover:text-primary"
  }`

const bottomItem = (active: boolean) =>
  `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-center text-[11px] font-medium leading-tight transition active:scale-95 ${
    active ? "text-primary" : "text-muted"
  }`

const pill = (active: boolean) =>
  `flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-primary/10" : ""}`

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const icons = {
  dashboard: <Icon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>,
  catalog: <Icon><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" /><path d="M4 21h15" /></Icon>,
  shop: <Icon><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 016 0" /></Icon>,
  admin: <Icon><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></Icon>,
  user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon>,
  meetings: <Icon><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3z" /></Icon>,
  bell: <Icon><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 004 0" /></Icon>,
}

function BottomTab({ to, label, icon, end, badge }: { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => bottomItem(isActive)}>
      {({ isActive }) => (
        <>
          <span className={`relative ${pill(isActive)}`}>
            {icon}
            {badge ? <span className="absolute right-1 top-0 min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{badge}</span> : null}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function StudentLayout() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const { unread } = useNotifications()
  const fr = i18n.language.startsWith("fr")
  const labels = {
    meetings: fr ? "Mes réunions" : "My meetings",
    meetingsShort: fr ? "Réunions" : "Meetings",
    notifications: "Notifications",
  }

  // Le menu se referme quand la page change (derive du chemin, sans effet)
  const menu = menuPath === pathname
  const setMenu = (v: boolean | ((m: boolean) => boolean)) =>
    setMenuPath((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null))

  async function handleLogout() {
    setMenu(false)
    await logout()
    toast.info(t("auth.logged_out"))
  }

  const menuItem = "block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60"

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
          <Link to="/etudiant" className="whitespace-nowrap text-lg font-extrabold tracking-tight text-primary">
            UNIX 
          </Link>
          <h1 className="text-center text-base font-bold text-ink">{i18n.language.startsWith("fr") ? "Formations" : "Courses"}</h1>
          <div className="flex items-center justify-end gap-3">
            {user && <span className="hidden max-w-[14rem] truncate text-xs text-muted lg:inline">{user.email}</span>}
            <button type="button" onClick={() => void handleLogout()} className="hidden min-h-[44px] text-sm font-medium text-muted transition-colors hover:text-ink md:block">
              {t("nav.logout")}
            </button>
            <PreferencesMenu />
          </div>
        </div>
        <nav aria-label={t("px.portal.student_brand")} className="mx-auto hidden max-w-5xl items-center gap-1 overflow-x-auto px-3 md:flex">
          <NavLink to="/etudiant" end className={tab}>{t("px.portal.nav_dashboard")}</NavLink>
          <NavLink to="/etudiant/catalogue" className={tab}>{t("px.portal.nav_catalog")}</NavLink>
          <NavLink to="/etudiant/reunions" className={action}>{labels.meetings}</NavLink>
          <NavLink to="/etudiant/notifications" className={action}>
            {labels.notifications}
            {unread > 0 && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{unread}</span>}
          </NavLink>
          <span className="ml-auto flex items-center gap-1">
            {user?.is_admin && <Link to="/admin" className="px-3 text-sm font-medium text-muted hover:text-ink">{t("px.portal.nav_admin")}</Link>}
            <Link to="/" className="px-3 text-sm font-medium text-muted hover:text-ink">{t("nav.shop")}</Link>
          </span>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <LiveBanner />
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoader />}>
            <div key={pathname} className="animate-fade-up"><Outlet /></div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-line bg-surface pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-center text-xs text-muted md:pb-4">
        &copy; {new Date().getFullYear()} UNIX &mdash; {t("px.portal.footer")}
      </footer>

      <WhatsAppFab />

      {menu && (
        <>
          <button type="button" aria-label={t("common.close")} className="fixed inset-0 z-40 md:hidden" onClick={() => setMenu(false)} />
          <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-50 w-56 rounded-card border border-line bg-surface p-2 shadow-card-lg md:hidden">
            {user && <p className="truncate px-3 py-2 text-sm text-muted">{user.email}</p>}
            {user && <NavLink to="/compte" className={menuItem}>{t("px.nav.my_account")}</NavLink>}
            <NavLink to="/" className={menuItem}>{t("nav.shop")}</NavLink>
            {user?.is_admin && <NavLink to="/admin" className={menuItem}>{t("px.portal.nav_admin")}</NavLink>}
            <button type="button" onClick={() => void handleLogout()} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-danger hover:bg-page active:bg-line/60">
              {t("nav.logout")}
            </button>
          </div>
        </>
      )}

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-[4.25rem] w-full max-w-md">
          <BottomTab to="/etudiant" end label={t("px.portal.nav_dashboard")} icon={icons.dashboard} />
          <BottomTab to="/etudiant/catalogue" label={t("px.portal.nav_catalog")} icon={icons.catalog} />
          <BottomTab to="/etudiant/reunions" label={labels.meetingsShort} icon={icons.meetings} />
          <BottomTab to="/etudiant/notifications" label={labels.notifications} icon={icons.bell} badge={unread} />
          <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={bottomItem(menu)}>
            <span className={pill(menu)}>{icons.user}</span>
            {t("nav.account")}
          </button>
        </div>
      </nav>
    </div>
  )
}