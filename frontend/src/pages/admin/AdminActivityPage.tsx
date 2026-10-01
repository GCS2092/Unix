import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"

export default function AdminActivityPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-activity", page, q],
    queryFn: async () => (await adminApi.activityLogs(page, q)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {t("admin.activity", { defaultValue: "Journal d'activité" })} {data && <span className="text-muted">({data.meta.total})</span>}
        </h2>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("admin.search_activity", { defaultValue: "Filtrer par action (ex : order, user)" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:w-72"
        />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_activity", { defaultValue: "Aucune activité enregistrée." })} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.col_date")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.actor", { defaultValue: "Auteur" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_action")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.subject", { defaultValue: "Objet" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString(locale)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.user_name ?? "—"}</p>
                    <p className="text-muted">{l.user_email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{l.subject_type ? `${l.subject_type} #${l.subject_id ?? ""}` : "—"}</td>
                  <td className="max-w-xs px-4 py-3">
                    {l.metadata && Object.keys(l.metadata).length > 0 ? (
                      <code className="block truncate text-xs text-muted" title={JSON.stringify(l.metadata)}>
                        {JSON.stringify(l.metadata)}
                      </code>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}