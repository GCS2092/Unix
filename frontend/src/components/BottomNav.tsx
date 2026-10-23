import { useTranslation } from "react-i18next"
import { useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { learnLinks, canSee } from "../lib/navLinks"
import { useKeyboardOpen } from "../hooks/useKeyboardOpen"

const itemClass = (active: boolean) =>
  `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition active:scale-95 ${active ? "font-semibold text-primary" : "font-medium text-muted"}`

const under = (pathname: string, bases: string[]) => bases.some((b) => pathname === b || pathname.startsWith(b + "/"))

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const icons = {
  home: <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Icon>,
  shop: <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>,
  cart: <Icon><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 016 0" /></Icon>,
  orders: <Icon><path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></Icon>,
  user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon>,
}

// Trait en haut + pastille derriere l'icone : la section courante se voit au premier coup d'oeil
function Pill({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className={`absolute left-1/2 top-0 h-0.5 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ${on ? "w-8 opacity-100" : "w-0 opacity-0"}`} />
      <span className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ${on ? "bg-primary/10" : ""}`}>{children}</span>
    </>
  )
}

function Tab({ to, label, icon, end, badge, also }: { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number; also?: string[] }) {
  const { pathname } = useLocation()
  const extra = !!also && under(pathname, also)
  return (
    <NavLink to={to} end={end} data-tour={to === "/boutique" ? "nav-shop" : to === "/panier" ? "nav-cart" : to === "/commandes" ? "nav-orders" : undefined} className={({ isActive }) => itemClass(isActive || extra)}>
      {({ isActive }) => (
        <>
          <Pill on={isActive || extra}>
            <span className="relative">
              {icon}
              {!!badge && badge > 0 && (
                <span key={badge} className="animate-pop absolute -right-2 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-[18px] text-ink">
                  {badge}
                </span>
              )}
            </span>
          </Pill>
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function BottomNav() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const count = useCartStore((s) => s.cart.items.reduce((n, i) => n + i.quantity, 0))
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const location = useLocation()
  const typing = useKeyboardOpen()

  // Le menu se referme quand la page change (derive du chemin, sans effet)
  const menu = menuPath === location.pathname
  const setMenu = (v: boolean | ((m: boolean) => boolean)) =>
    setMenuPath((prev) => ((typeof v === "function" ? v(prev === location.pathname) : v) ? location.pathname : null))
  const accountOn = menu || under(location.pathname, ["/compte"])

  async function handleLogout() {
    setMenu(false)
    await logout()
    toast.info(t("auth.logged_out"))
  }

  return (
    <>
      {menu && (
        <>
          <button type="button" aria-label={t("common.close")} className="fixed inset-0 z-40 md:hidden" onClick={() => setMenu(false)} />
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-50 w-56 rounded-card border border-line bg-surface p-2 shadow-card-lg md:hidden">
            {user && <p className="truncate px-3 py-2 text-sm text-muted">{user.email}</p>}
            {user && (
              <NavLink to="/compte" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60">
                {t("px.nav.my_account")}
              </NavLink>
            )}
            {learnLinks.filter((l) => canSee(l, user)).map((l) => (
              <NavLink key={l.to} to={l.to} className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60">
                {t(l.labelKey)}
              </NavLink>
            ))}
            {user?.is_admin && (
              <NavLink to="/admin" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60">
                {t("nav.admin_long")}
              </NavLink>
            )}
            <button type="button" onClick={() => void handleLogout()} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-danger hover:bg-page active:bg-line/60">
              {t("nav.logout")}
            </button>
          </div>
        </>
      )}

      <nav
        aria-label={t("nav.main")}
        className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 md:hidden ${typing ? "translate-y-full" : ""}`}
      >
        <div className="mx-auto flex h-16 w-full max-w-md">
          <Tab to="/" end label={t("nav.home")} icon={icons.home} />
          <Tab to="/boutique" label={t("nav.shop")} icon={icons.shop} />
          <Tab to="/panier" label={t("nav.cart")} icon={icons.cart} badge={count} also={["/commande"]} />
          <Tab to="/commandes" label={t("nav.orders")} icon={icons.orders} also={["/suivi"]} />
          {user ? (
            <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={itemClass(accountOn)}>
              <Pill on={accountOn}>{icons.user}</Pill>
              {t("nav.account")}
            </button>
          ) : (
            <Tab to="/connexion" label={t("nav.account")} icon={icons.user} also={["/inscription", "/mot-de-passe"]} />
          )}
        </div>
      </nav>
    </>
  )
}