import { Suspense } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "../components/Navbar"
import BottomNav from "../components/BottomNav"
import Footer from "../components/Footer"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"

export default function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <div key={pathname} className="animate-fade-up"><Outlet /></div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}