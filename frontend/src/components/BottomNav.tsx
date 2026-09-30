import { useTranslation } from "react-i18next"
import { useEffect, useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"

const itemClass = (active: boolean) =>
  `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95 ${active ? "text-primary" : "text-muted"}`

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

function Tab({ to, label, icon, end, badge }: { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => itemClass(isActive)}>
      <span className="relative">
        {icon}
        {!!badge && badge > 0 && (
          <span key={badge} className="animate-pop absolute -right-2 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-[18px] text-ink">
            {badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  )
}

export default function BottomNav() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const count = useCartStore((s) => s.cart.items.reduce((n, i) => n + i.quantity, 0))
  const [menu, setMenu] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenu(false)
  }, [location.pathname])

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
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-md">
          <Tab to="/" end label={t("nav.home")} icon={icons.home} />
          <Tab to="/boutique" label={t("nav.shop")} icon={icons.shop} />
          <Tab to="/panier" label={t("nav.cart")} icon={icons.cart} badge={count} />
          <Tab to="/commandes" label={t("nav.orders")} icon={icons.orders} />
          {user ? (
            <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={itemClass(menu)}>
              {icons.user}
              {t("nav.account")}
            </button>
          ) : (
            <Tab to="/connexion" label={t("nav.account")} icon={icons.user} />
          )}
        </div>
      </nav>
    </>
  )
}