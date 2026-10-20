import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { requestsAdminApi } from "../../api/requestsAdmin"
import { Pill } from "../../components/admin/ui"

export default function RequestsBanner() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ["admin-requests", "count"],
    queryFn: async () => (await requestsAdminApi.list({ status: "pending" })).data.counts.pending,
    staleTime: 0,
  })
  const pending = q.data ?? 0
  if (pending === 0) return null

  return (
    <Link
      to="/admin/formation/demandes"
      className="flex items-center justify-between gap-3 rounded-card border border-accent/50 bg-accent/5 p-4 shadow-card transition hover:bg-accent/10 sm:p-5"
    >
      <span className="flex items-center gap-2 text-base font-bold">
        {t("px.req.title_all", { defaultValue: "Demandes d'inscription" })}
        <Pill tone="warn" dot>{pending}</Pill>
      </span>
      <span className="text-sm font-semibold text-primary">
        {t("px.rq.manage_pending", { defaultValue: "Traiter les demandes" })} →
      </span>
    </Link>
  )
}