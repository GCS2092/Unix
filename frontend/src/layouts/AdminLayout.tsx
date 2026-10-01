import { Suspense, useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"
import PreferencesMenu from "../components/PreferencesMenu"

const links = [
  { to: "/admin/tableau-de-bord", key: "dashboard", label: "Tableau de bord" },
  { to: "/admin/produits", key: "products", label: "Produits" },
  { to: "/admin/commandes", key: "orders", label: "Commandes" },
  { to: "/admin/cours", key: "courses", label: "Cours" },
  { to: "/admin/inscriptions", key: "enrollments", label: "Inscriptions" },
  { to: "/admin/utilisateurs", key: "users", label: "Utilisateurs" },
  { to: "/admin/journal", key: "activity", label: "Journal d'activité" },
  { to: "/admin/parametres", key: "settings", label: "Paramètres" },
]

const item = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold transition active:scale-[0.98] ${
    isActive ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`

export default function AdminLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function handleLogout() {
    await logout()
    toast.info(t("auth.logged_out"))
  }

  return (
    <div className="min-h-screen bg-page lg:flex">
      {open && (
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink p-4 pt-[calc(1rem+env(safe-area-inset-top))] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <span className="text-xl font-extrabold tracking-tight text-white">
            UNIX <span className="text-sm font-semibold text-primary-light">Admin</span>
          </span>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden">
            ✕
          </button>
        </div>

        <nav aria-label="Administration" className="flex-1 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={item}>
              {t(`admin.${l.key}`, { defaultValue: l.label })}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4 pb-[env(safe-area-inset-bottom)]">
          {user && <p className="truncate px-1 text-xs text-slate-400">{user.email}</p>}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-2 flex min-h-[44px] w-full items-center rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-white/10"
          >
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-page active:bg-line/60"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-extrabold text-primary">UNIX Admin</span>
          <PreferencesMenu />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <div key={pathname} className="animate-fade-up"><Outlet /></div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}