import { useTranslation } from "react-i18next"
import { Skeleton } from "./Skeleton"

export default function PageLoader() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t("states.loading")} className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}