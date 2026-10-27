import BrandName from "./BrandName"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { buttonClass } from "./buttonStyles"
import PreferencesMenu from "./PreferencesMenu"
import TourButton from "./TourButton"
import { shopLinks, learnLinks, canSee, type NavItem } from "../lib/navLinks"

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `relative py-1 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-[18px] after:h-0.5 after:origin-center after:rounded-full after:bg-primary after:transition-transform after:duration-300 ${isActive ? "font-semibold text-primary after:scale-x-100" : "text-muted after:scale-x-0 hover:text-ink"}`

export default function Navbar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const inCheckout = /^\/commande(\/|$)/.test(pathname)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const count = useCartStore((s) => s.cart.items.reduce((n, i) => n + i.quantity, 0))

  async function handleLogout() {
    await logout()
    toast.info(t("auth.logged_out"))
  }

  const visible = (items: NavItem[]) => items.filter((l) => canSee(l, user))

  const renderLinks = (items: NavItem[]) =>
    visible(items).map((l) => (
      <NavLink key={l.to} to={l.to} className={({ isActive }) => desktopLink({ isActive: isActive || (l.to === "/panier" && inCheckout) })} data-tour={l.to === "/boutique" ? "nav-shop" : l.to === "/panier" ? "nav-cart" : l.to === "/commandes" ? "nav-orders" : undefined}>
        {t(l.labelKey)}
        {l.to === "/panier" && count > 0 && (
          <span key={count} className="animate-pop ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-ink">{count}</span>
        )}
      </NavLink>
    ))

  return (
    <><div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-top))] md:h-[calc(4rem+env(safe-area-inset-top))]" /><header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16">
        <Link to="/" className="text-xl font-extrabold tracking-tight text-primary"><BrandName /></Link>

        <div className="hidden items-center gap-6 md:flex">
          <div className="flex items-center gap-5">{renderLinks(shopLinks)}</div>
          {visible(learnLinks).length > 0 && (<><span className="h-5 w-px bg-line" aria-hidden="true" /><div className="flex items-center gap-5">{renderLinks(learnLinks)}</div></>)}
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          {user ? (
            <>
              <NavLink to="/compte" className={desktopLink}>{t("px.nav.my_account")}</NavLink>
              {user.is_admin && <NavLink to="/admin" className={desktopLink}>{t("nav.admin")}</NavLink>}
              <button type="button" onClick={() => void handleLogout()} className="text-sm font-medium text-muted transition-colors hover:text-ink active:scale-95">
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/inscription" className={desktopLink}>{t("nav.register")}</NavLink>
              <Link to="/connexion" className={buttonClass({ size: "sm" })}>{t("nav.login")}</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TourButton /><PreferencesMenu />
        </div>
      </nav>
    </header></>
  )
}