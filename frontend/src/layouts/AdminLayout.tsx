import { useTranslation } from "react-i18next"
import { NavLink, Outlet } from "react-router-dom"

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${isActive ? "bg-primary text-white" : "text-muted hover:bg-page hover:text-ink"}`

export default function AdminLayout() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{t("admin.title")}</h1>
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-line pb-3">
        <NavLink to="/admin/produits" className={tab}>{t("admin.products")}</NavLink>
        <NavLink to="/admin/commandes" className={tab}>{t("admin.orders")}</NavLink>
      </div>
      <Outlet />
    </div>
  )
}