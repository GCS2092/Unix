import i18n from "../i18n"

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-shimmer relative overflow-hidden rounded-lg ${className}`} />
}

// Meme structure que ProductCard : image 4/5, titre sur 2 lignes, prix, bouton, lien WhatsApp
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label={i18n.t("states.loading")} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <Skeleton className="aspect-square rounded-none" />
          <div className="flex flex-col gap-2 p-3 sm:p-4">
            <div className="min-h-[2.5rem] space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <Skeleton className="h-7 w-1/3" />
            <div className="pt-1">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="mt-1.5 h-5 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Meme structure que MiniCard de l'accueil (defilement horizontal sur mobile, grille ensuite)
export function HomeRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label={i18n.t("states.loading")}
      className="-mx-4 flex gap-3 overflow-x-hidden px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[156px] flex-none overflow-hidden rounded-card border border-line bg-surface shadow-card sm:w-auto">
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-3">
            <div className="min-h-[2.5rem] space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div role="status" aria-label={i18n.t("states.loading")} className="mt-2 grid gap-6 lg:grid-cols-3 lg:gap-8">
      <div className="lg:col-span-2">
        <Skeleton className="aspect-[4/3] w-full rounded-card sm:aspect-video" />
        <Skeleton className="mt-6 h-8 w-2/3" />
        <Skeleton className="mt-4 h-7 w-1/4" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-11/12" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
      <Skeleton className="hidden h-40 rounded-card lg:block" />
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label={i18n.t("states.loading")} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/3" />
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Meme structure que AdminDashboardPage : en-tete, periodes, tuiles d'action, KPI, courbe, cartes
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label={i18n.t("states.loading")} className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />)}
        </div>
        <Skeleton className="h-3 w-52" />
      </div>
      <section>
        <Skeleton className="mb-3 h-3 w-32" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[66px] rounded-card sm:h-[74px]" />)}
        </div>
      </section>
      <section>
        <Skeleton className="mb-3 h-3 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="col-span-2 h-[124px] rounded-card" />
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-card" />)}
        </div>
      </section>
      <Skeleton className="h-[330px] rounded-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-card" />
        <Skeleton className="h-52 rounded-card" />
      </div>
    </div>
  )
}