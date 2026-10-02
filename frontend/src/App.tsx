import { lazy, useEffect } from "react"
import { Link, Navigate, Route, Routes } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import PublicLayout from "./layouts/PublicLayout"
import AdminLayout from "./layouts/AdminLayout"
import HomePage from "./pages/HomePage"
import Toaster from "./components/Toaster"
import ConfirmHost from "./components/ConfirmHost"
import ScrollToTop from "./components/ScrollToTop"
import RequireAuth from "./components/RequireAuth"
import RequireAdmin from "./components/RequireAdmin"
import { useAuthStore } from "./stores/authStore"
import { useCartStore } from "./stores/cartStore"
import { useCurrencyStore } from "./stores/currencyStore"

const ProductsPage = lazy(() => import("./pages/ProductsPage"))
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"))
const CartPage = lazy(() => import("./pages/CartPage"))
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"))
const CheckoutReturnPage = lazy(() => import("./pages/CheckoutReturnPage"))
const LoginPage = lazy(() => import("./pages/LoginPage"))
const RegisterPage = lazy(() => import("./pages/RegisterPage"))
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"))
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"))
const OrdersPage = lazy(() => import("./pages/OrdersPage"))
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"))
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"))
const AdminStockPage = lazy(() => import("./pages/admin/AdminStockPage"))
const AdminCoursesPage = lazy(() => import("./pages/admin/AdminCoursesPage"))
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"))
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"))
const AdminOrderPrintPage = lazy(() => import("./pages/admin/AdminOrderPrintPage"))
const AdminEnrollmentsPage = lazy(() => import("./pages/admin/AdminEnrollmentsPage"))
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"))
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"))

function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="py-16 text-center">
      <p className="text-muted">{t("common.not_found")}</p>
      <Link to="/" className="mt-2 inline-block font-semibold text-primary">{t("common.back_home")}</Link>
    </div>
  )
}

export default function App() {
  const initAuth = useAuthStore((s) => s.init)
  const fetchCart = useCartStore((s) => s.fetch)
  const loadRates = useCurrencyStore((s) => s.loadRates)
  const queryClient = useQueryClient()
  const { i18n } = useTranslation()

  // Les noms de produits viennent du serveur : on les recharge quand la langue change
  useEffect(() => {
    const onChange = () => {
      void queryClient.invalidateQueries()
      void fetchCart().catch(() => undefined)
    }
    i18n.on("languageChanged", onChange)
    return () => {
      i18n.off("languageChanged", onChange)
    }
  }, [i18n, queryClient, fetchCart])

  useEffect(() => {
    void initAuth()
    void fetchCart().catch(() => undefined)
    void loadRates()
  }, [initAuth, fetchCart, loadRates])

  return (
    <>
      <Toaster />
      <ConfirmHost />
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="boutique" element={<ProductsPage />} />
          <Route path="boutique/:slug" element={<ProductDetailPage />} />
          <Route path="panier" element={<CartPage />} />
          <Route path="commande" element={<CheckoutPage />} />
          <Route path="commande/retour" element={<CheckoutReturnPage />} />
          <Route path="connexion" element={<LoginPage />} />
          <Route path="inscription" element={<RegisterPage />} />
          <Route path="mot-de-passe/oublie" element={<ForgotPasswordPage />} />
          <Route path="mot-de-passe/reinitialiser" element={<ResetPasswordPage />} />
          <Route path="commandes" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Navigate to="tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<AdminDashboardPage />} />
          <Route path="produits" element={<AdminProductsPage />} />
        <Route path="stock" element={<AdminStockPage />} />
          <Route path="commandes" element={<AdminOrdersPage />} />
          <Route path="commandes/:id/bon" element={<AdminOrderPrintPage />} />
          <Route path="cours" element={<AdminCoursesPage />} />
          <Route path="inscriptions" element={<AdminEnrollmentsPage />} />
          <Route path="utilisateurs" element={<AdminUsersPage />} />
          <Route path="journal" element={<AdminActivityPage />} />
          <Route path="parametres" element={<AdminSettingsPage />} />
        </Route>
      </Routes>
    </>
  )
}