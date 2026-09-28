import i18n from "../i18n"

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-line/70 ${className}`} />
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label={i18n.t("states.loading")} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3 sm:p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-11 w-full" />
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