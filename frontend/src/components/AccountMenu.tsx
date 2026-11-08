import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Award, Bell, BookOpen, ChevronDown, LayoutDashboard, LogOut, ShieldCheck, Store, User, Video } from "lucide-react"
import { accountKind } from "../lib/accountKind"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (email.trim().charAt(0) || "?").toUpperCase()
}

const item =
  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition hover:bg-page active:bg-line/60"

function MenuLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} role="menuitem" className={item}>
      <span className="text-muted" aria-hidden="true">{icon}</span>
      {children}
    </Link>
  )
}

/** Avatar du compte (ecrans larges) : identite, acces rapides et deconnexion. */
export default function AccountMenu() {
  const { t, i18n } = useTranslation()
  const L = (a: string, b: string) => (i18n.language.startsWith("en") ? b : a)
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  // Le menu se referme quand la page change (derive du chemin, sans effet)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpenPath(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenPath(null) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!user) return null

  const name = user.name ?? ""
  const ini = initials(name, user.email ?? "")
  const ic = "h-4 w-4"
  const hasShop = accountKind(user) !== "formation"

  async function out() {
    setOpenPath(null)
    await logout()
    toast.info(t("auth.logged_out"))
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={L("Mon compte", "My account")}
        onClick={() => setOpenPath(open ? null : pathname)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-full pl-1 pr-2 transition hover:bg-black/5 active:scale-95"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">{ini}</span>
        <ChevronDown className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-card-lg">
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-base font-bold text-white">{ini}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name || L("Mon compte", "My account")}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <div className="py-1.5">
            <MenuLink to="/etudiant" icon={<LayoutDashboard className={ic} />}>{L("Mes formations", "My courses")}</MenuLink>
            <MenuLink to="/etudiant/catalogue" icon={<BookOpen className={ic} />}>{L("Catalogue", "Catalogue")}</MenuLink>
            <MenuLink to="/etudiant/certificats" icon={<Award className={ic} />}>{L("Mes certificats", "My certificates")}</MenuLink>
            <MenuLink to="/etudiant/reunions" icon={<Video className={ic} />}>{L("Mes réunions", "My meetings")}</MenuLink>
            <MenuLink to="/etudiant/notifications" icon={<Bell className={ic} />}>Notifications</MenuLink>
            <MenuLink to="/etudiant/compte" icon={<User className={ic} />}>{L("Mon compte", "My account")}</MenuLink>
          </div>

          {(hasShop || user.is_admin) && (
            <div className="border-t border-line py-1.5">
              {hasShop && <MenuLink to="/" icon={<Store className={ic} />}>{L("Boutique", "Shop")}</MenuLink>}
              {user.is_admin && <MenuLink to="/admin" icon={<ShieldCheck className={ic} />}>{L("Espace administration", "Administration")}</MenuLink>}
            </div>
          )}

          <div className="border-t border-line pt-1.5">
            <button type="button" role="menuitem" onClick={() => void out()} className={`${item} w-full text-danger hover:bg-danger/10`}>
              <LogOut className={ic} aria-hidden="true" />{t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}