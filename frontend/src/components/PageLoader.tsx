import { useTranslation } from "react-i18next"
import { Skeleton } from "./Skeleton"
import RoadLoader from "./RoadLoader"

// Apparait apres 120 ms (pas de flash sur les navigations rapides)
export default function PageLoader() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t("states.loading")} className="loader-delay">
      <div className="route-bar" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-50 flex justify-center" aria-hidden="true">
        <div className="rounded-full border border-line bg-surface/95 px-4 pb-1 pt-2 shadow-card-lg">
          <RoadLoader compact />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}