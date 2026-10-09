import { Suspense, useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../api/admin"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { adminPaths, adminScopeOf, type AdminSpace } from "../lib/adminPaths"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"
import PreferencesMenu from "../components/PreferencesMenu"

interface NavGroup {
  key: string
  label: string
  links: { to: string; key: string; label: string }[]
}

const P = adminPaths

const GROUPS: Record<AdminSpace, NavGroup[]> = {
  shop: [
    {
      key: "overview",
      label: "Vue d'ensemble",
      links: [
        { to: P.shop.dashboard, key: "dashboard", label: "Tableau de bord" },
        { to: P.shop.overview, key: "overview", label: "Aperçu" },
      ],
    },
    {
      key: "shop",
      label: "Boutique",
      links: [
        { to: P.shop.products, key: "products", label: "Produits" },
        { to: P.shop.stock, key: "stock", label: "Stock" },
        { to: P.shop.orders, key: "orders", label: "Commandes" },
        { to: P.shop.invoices, key: "invoices", label: "Factures" },
      ],
    },
    {
      key: "config",
      label: "Configuration",
      links: [{ to: P.shop.settings, key: "settings", label: "Paramètres" }],
    },
  ],
  formation: [
    {
      key: "overview",
      label: "Vue d'ensemble",
      links: [{ to: P.formation.dashboard, key: "dashboard", label: "Tableau de bord" }],
    },
    {
      key: "training",
      label: "Formation",
      links: [
        { to: P.formation.courses, key: "courses", label: "Cours" },
        { to: P.formation.live, key: "live", label: "Direct" },
        { to: P.formation.sessions, key: "sessions", label: "Séances planifiées" },
        { to: P.formation.enrollments, key: "enrollments", label: "Inscriptions" },
      ],
    },
  ],
  system: [
    {
      key: "system",
      label: "Système",
      links: [
        { to: P.system.users, key: "users", label: "Utilisateurs" },
        { to: P.system.activity, key: "activity", label: "Journal d'activité" },
      ],
    },
  ],
}

const SPACE_LABEL: Record<AdminSpace, string> = { shop: "Boutique", formation: "Formation", system: "Système" }

const SWITCH: { space: AdminSpace; to: string }[] = [
  { space: "shop", to: P.shop.dashboard },
  { space: "formation", to: P.formation.dashboard },
  { space: "system", to: P.system.users },
]

const item = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold transition active:scale-[0.98] ${
    isActive ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`

export default function AdminLayout({ space }: { space: AdminSpace }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const isSuper = adminScopeOf(user) === "super"
  const groups = GROUPS[space]

  // Les badges sont une API boutique : on ne les appelle que dans l'espace boutique
  const { data: nav } = useQuery({
    queryKey: ["admin-nav-badge"],
    queryFn: async () => (await adminApi.badges()).data.data,
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: space === "shop",
  })
  const badges: Record<string, number> = { orders: nav?.orders_to_process ?? 0 }

  // Le menu se referme quand la page change (derive du chemin, sans effet)
  const open = openPath === pathname
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenPath((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenPath(null)
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
        <div className="mb-4 flex items-center justify-between px-1">
          <span className="text-xl font-extrabold tracking-tight text-white">
            UNIX <span className="text-sm font-semibold text-primary-light">{SPACE_LABEL[space]}</span>
          </span>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden">
            ✕
          </button>
        </div>

        {isSuper && (
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1" aria-label="Espaces">
            {SWITCH.map((s) => (
              <Link
                key={s.space}
                to={s.to}
                className={`rounded-md px-1 py-2 text-center text-xs font-semibold transition ${
                  s.space === space ? "bg-primary text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {SPACE_LABEL[s.space]}
              </Link>
            ))}
          </div>
        )}

        <nav aria-label="Administration" className="flex-1 space-y-4 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t(`admin.group_${g.key}`, { defaultValue: g.label })}
              </p>
              <div className="space-y-1">
                {g.links.map((l) => (
                  <NavLink key={l.to} to={l.to} className={item}>
                    <span className="flex-1">{t(`admin.${l.key}`, { defaultValue: l.label })}</span>
                    {(badges[l.key] ?? 0) > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{badges[l.key]}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
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
          <span className="font-extrabold text-primary">UNIX {SPACE_LABEL[space]}</span>
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