import { lazy, useEffect } from "react"
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import "./lib/extraTranslations"
import PublicLayout from "./layouts/PublicLayout"
import AdminLayout from "./layouts/AdminLayout"
import HomePage from "./pages/HomePage"
import Toaster from "./components/Toaster"
import ConfirmHost from "./components/ConfirmHost"
import ScrollToTop from "./components/ScrollToTop"
import RequireAuth from "./components/RequireAuth"
import RequireAdmin from "./components/RequireAdmin"
import AdminSpaceLoginPage from "./pages/admin/AdminSpaceLoginPage"
import { adminHome, legacyAdminPath } from "./lib/adminPaths"
import RequireStudentArea from "./components/RequireStudentArea"
import StudentLayout from "./layouts/StudentLayout"
import StudentLoginPage from "./pages/StudentLoginPage"
import GuestJoinPage from "./pages/GuestJoinPage"
import AdminLoginPage from "./pages/admin/AdminLoginPage"
import { LegacyCourseRedirect } from "./components/LegacyRedirects"
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
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"))
const TrackPage = lazy(() => import("./pages/TrackPage"))
const CoursesPage = lazy(() => import("./pages/CoursesPage"))
const AccountPage = lazy(() => import("./pages/AccountPage"))
const MyCoursesPage = lazy(() => import("./pages/MyCoursesPage"))
const CoursePlayerPage = lazy(() => import("./pages/CoursePlayerPage"))
const LiveJoinPage = lazy(() => import("./pages/LiveJoinPage"))
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"))
const MeetingsPage = lazy(() => import("./pages/MeetingsPage"))
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"))
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"))
const AdminStockPage = lazy(() => import("./pages/admin/AdminStockPage"))
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"))
const AdminInvoicesPage = lazy(() => import("./pages/admin/AdminInvoicesPage"))
const AdminCoursesPage = lazy(() => import("./pages/admin/AdminCoursesPage"))
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"))
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"))
const AdminOrderPrintPage = lazy(() => import("./pages/admin/AdminOrderPrintPage"))
const AdminOrderTrackingPage = lazy(() => import("./pages/admin/AdminOrderTrackingPage"))
const AdminEnrollmentsPage = lazy(() => import("./pages/admin/AdminEnrollmentsPage"))
const AdminFormationsPage = lazy(() => import("./pages/admin/AdminFormationsPage"))
const AdminLivePage = lazy(() => import("./pages/admin/AdminLivePage"))
const AdminSessionsPage = lazy(() => import("./pages/admin/AdminSessionsPage"))
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"))
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"))

function AdminEntry() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={adminHome(user)} replace />
}

function LegacyAdminRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={legacyAdminPath(pathname, search) ?? "/admin"} replace />
}

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
        <Route path="rejoindre/:invite" element={<GuestJoinPage />} />
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
          <Route path="commandes/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="suivi/:token" element={<TrackPage />} />
          <Route path="compte" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="formations" element={<Navigate to="/etudiant/catalogue" replace />} />
        <Route path="mes-cours" element={<Navigate to="/etudiant" replace />} />
        <Route path="mes-cours/:id" element={<LegacyCourseRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="etudiant/connexion" element={<StudentLoginPage />} />
        <Route path="etudiant" element={<RequireStudentArea><StudentLayout /></RequireStudentArea>}>
          <Route index element={<MyCoursesPage />} />
          <Route path="catalogue" element={<CoursesPage />} />
          <Route path="cours/:id" element={<CoursePlayerPage />} />
          <Route path="direct/:courseId" element={<LiveJoinPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reunions" element={<MeetingsPage />} />
        </Route>

        <Route path="admin/connexion" element={<AdminLoginPage />} />
        <Route path="admin/boutique/connexion" element={<AdminSpaceLoginPage space="shop" />} />
        <Route path="admin/formation/connexion" element={<AdminSpaceLoginPage space="formation" />} />
        <Route path="admin" element={<RequireAdmin><AdminEntry /></RequireAdmin>} />

        <Route path="admin/boutique" element={<RequireAdmin space="shop"><AdminLayout space="shop" /></RequireAdmin>}>
          <Route index element={<Navigate to="tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<AdminDashboardPage />} />
          <Route path="apercu" element={<AdminOverviewPage />} />
          <Route path="produits" element={<AdminProductsPage />} />
          <Route path="stock" element={<AdminStockPage />} />
          <Route path="commandes" element={<AdminOrdersPage />} />
          <Route path="commandes/:id/bon" element={<AdminOrderPrintPage />} />
          <Route path="commandes/:id/suivi" element={<AdminOrderTrackingPage />} />
          <Route path="factures" element={<AdminInvoicesPage />} />
          <Route path="parametres" element={<AdminSettingsPage />} />
        </Route>

        <Route path="admin/formation" element={<RequireAdmin space="formation"><AdminLayout space="formation" /></RequireAdmin>}>
          <Route index element={<Navigate to="tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<AdminFormationsPage />} />
          <Route path="cours" element={<AdminCoursesPage />} />
          <Route path="direct" element={<AdminLivePage />} />
          <Route path="seances" element={<AdminSessionsPage />} />
          <Route path="inscriptions" element={<AdminEnrollmentsPage />} />
        </Route>

        <Route path="admin/systeme" element={<RequireAdmin space="system"><AdminLayout space="system" /></RequireAdmin>}>
          <Route index element={<Navigate to="utilisateurs" replace />} />
          <Route path="utilisateurs" element={<AdminUsersPage />} />
          <Route path="journal" element={<AdminActivityPage />} />
        </Route>

        <Route path="admin/*" element={<LegacyAdminRedirect />} />
      </Routes>
    </>
  )
}
