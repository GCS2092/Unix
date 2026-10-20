import BrandName from "../components/BrandName"
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
import TourButton from "../components/TourButton"
import { useTourStore } from "../stores/tourStore"
import { Svg } from "../components/admin/ui"

interface NavGroup {
  key: string
  label: string
  links: { to: string; key: string; label: string }[]
}

const P = adminPaths

const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  overview: "M3 3v18h18M7 15l4-4 3 3 5-6",
  products: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8",
  stock: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  orders: "M6 7h12l-1 13H7L6 7zM9 7a3 3 0 016 0",
  payments: "M3 7h18v12H3zM3 11h18M7 15h3",
  invoices: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  customers: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  settings: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
  courses: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 21h15",
  live: "M3 6h12v12H3zM15 10l6-3v10l-6-3z",
  sessions: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  enrollments: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  requests: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z",
  share: "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13",
  activity: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
}

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
        { to: P.shop.payments, key: "payments", label: "Paiements" },
        { to: P.shop.invoices, key: "invoices", label: "Factures" },
        { to: P.shop.customers, key: "customers", label: "Clients" },
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
        { to: P.formation.requests, key: "requests", label: "Demandes d'inscription" },
        { to: P.formation.share, key: "share", label: "Liens à partager" },
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
  `group flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition active:scale-[0.98] ${
    isActive ? "bg-primary text-white shadow-md ring-1 ring-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`

export default function AdminLayout({ space }: { space: AdminSpace }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const isSuper = adminScopeOf(user) === "super"
  const restartTour = useTourStore((s) => s.restart)
  const instructor = adminScopeOf(user) === "instructor"
  const hiddenForInstructor = ["enrollments", "requests"]
  const groups = GROUPS[space]
    .map((g) => ({ ...g, links: instructor ? g.links.filter((l) => !hiddenForInstructor.includes(l.key)) : g.links }))
    .filter((g) => g.links.length > 0)

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

  // La visite guidee ouvre/ferme le tiroir du menu sur mobile
  useEffect(() => {
    const onMenu = (e: Event) => setOpenPath((e as CustomEvent<boolean>).detail ? window.location.pathname : null)
    window.addEventListener("unix:admin-menu", onMenu)
    return () => window.removeEventListener("unix:admin-menu", onMenu)
  }, [])

  async function handleLogout() {
    await logout()
    toast.info(t("auth.logged_out"))
  }

  const initial = (user?.email ?? "?").charAt(0).toUpperCase()

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
        <div className="mb-5 flex items-center justify-between px-1">
          <span className="text-xl font-extrabold tracking-tight text-white">
            <BrandName /> <span className="ml-1 rounded-full bg-accent/20 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-accent">{SPACE_LABEL[space]}</span>
          </span>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden">
            ✕
          </button>
        </div>

        {isSuper && (
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1" aria-label="Espaces" data-tour="admin-switch">
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

        <nav aria-label="Administration" className="flex-1 space-y-5 overflow-y-auto pr-1">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t(`admin.group_${g.key}`, { defaultValue: g.label })}
              </p>
              <div className="space-y-0.5">
                {g.links.map((l) => (
                  <NavLink key={l.to} to={l.to} className={item} data-tour={`admin-${l.key}`}>
                    <Svg d={ICONS[l.key] ?? ICONS.dashboard} className="h-[18px] w-[18px] shrink-0 opacity-90" />
                    <span className="flex-1">{t(`admin.${l.key}`, { defaultValue: l.label })}</span>
                    {(badges[l.key] ?? 0) > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">{badges[l.key]}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div data-tour="admin-account" className="mt-4 border-t border-white/10 pt-4 pb-[env(safe-area-inset-bottom)]">
          {user && (
            <div className="flex items-center gap-3 px-1">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, #0ea5e9 100%)" }}>{initial}</span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{user.name ?? user.email}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
            </div>
          )}
          <button type="button" onClick={restartTour} data-tour="admin-help" className="mt-3 flex min-h-[44px] w-full items-center rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{t("tour.restart")}</button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-1 flex min-h-[44px] w-full items-center rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-white/10"
          >
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-8 backdrop-blur lg:flex">
          <p className="text-sm text-muted">
            {t("admin.space_label", { defaultValue: "Espace" })} <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><span className="h-2 w-2 rounded-full bg-accent" />{SPACE_LABEL[space]}</span>
          </p>
          <div className="flex items-center gap-2"><TourButton /><PreferencesMenu /></div>
        </header>

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
          <span className="font-extrabold text-primary"><BrandName /> {SPACE_LABEL[space]}</span>
          <div className="flex items-center gap-2"><TourButton /><PreferencesMenu /></div>
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

