import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminEnrollment } from "../../api/admin"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"

export default function AdminEnrollmentsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-enrollments", page, q, status],
    queryFn: async () => (await adminApi.enrollments(page, q, status)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const reissue = useMutation({
    mutationFn: (e: AdminEnrollment) => adminApi.reissueCertificate(e.id),
    onSuccess: async () => {
      toast.success(t("admin.certificate_ok", { defaultValue: "Certificat généré" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-enrollments"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (e: AdminEnrollment) => apiClient.delete(`/admin/enrollments/${e.id}`),
    onSuccess: async () => {
      toast.success(t("admin.enrollment_removed", { defaultValue: "Inscription retirée" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-enrollments"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function handleRemove(e: AdminEnrollment) {
    const msg = t("admin.confirm_remove_enrollment", {
      defaultValue: "Retirer {{name}} du cours « {{course}} » ? Il perdra l'accès au cours et au direct.",
      name: e.user_name ?? "",
      course: e.course_title ?? "",
    })
    if (window.confirm(msg)) remove.mutate(e)
  }

  async function handleDownload(e: AdminEnrollment) {
    if (!e.certificate_id) return
    try {
      const res = await adminApi.downloadCertificate(e.certificate_id)
      saveBlob(res.data, `certificat-${e.certificate_id}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  function handleReissue(e: AdminEnrollment) {
    const msg = e.certificate_id
      ? t("admin.confirm_reissue", { defaultValue: "Régénérer le certificat de {{name}} ? L'ancien fichier sera remplacé.", name: e.user_name ?? "" })
      : t("admin.confirm_issue", { defaultValue: "Émettre le certificat de {{name}} ?", name: e.user_name ?? "" })
    if (window.confirm(msg)) reissue.mutate(e)
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">
        {t("admin.enrollments", { defaultValue: "Inscriptions" })} {data && <span className="text-muted">({data.meta.total})</span>}
      </h2>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("admin.search_enrollments", { defaultValue: "Élève, e-mail ou cours" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          aria-label={t("admin.col_status")}
          className="min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
        >
          <option value="">{t("admin.all_statuses", { defaultValue: "Tous les statuts" })}</option>
          <option value="in_progress">{t("admin.in_progress", { defaultValue: "En cours" })}</option>
          <option value="completed">{t("admin.completed", { defaultValue: "Terminé" })}</option>
        </select>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_enrollments", { defaultValue: "Aucune inscription." })} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.student", { defaultValue: "Élève" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.course", { defaultValue: "Cours" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.progress", { defaultValue: "Progression" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.certificate", { defaultValue: "Certificat" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_date")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("admin.col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.user_name ?? "—"}</p>
                    <p className="text-muted">{e.user_email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">{e.course_title ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
                        <div className={`h-full ${e.completed ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(100, e.progress)}%` }} />
                      </div>
                      <span className="text-xs text-muted">{e.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e.certificate_issued_at ? (
                      <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        {new Date(e.certificate_issued_at).toLocaleDateString(locale)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString(locale)}</td>
                  <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleRemove(e)}
                      disabled={remove.isPending}
                      className="font-semibold text-danger hover:underline disabled:opacity-50"
                    >
                      {t("admin.remove_enrollment", { defaultValue: "Retirer" })}
                    </button>
                    {e.certificate_id && (
                      <button type="button" onClick={() => void handleDownload(e)} className="font-semibold text-primary hover:underline">
                        {t("admin.download", { defaultValue: "Télécharger" })}
                      </button>
                    )}
                    {e.completed && (
                      <button
                        type="button"
                        onClick={() => handleReissue(e)}
                        disabled={reissue.isPending}
                        className="font-semibold text-muted hover:text-ink disabled:opacity-50"
                      >
                        {e.certificate_id ? t("admin.reissue", { defaultValue: "Réémettre" }) : t("admin.issue", { defaultValue: "Émettre" })}
                      </button>
                    )}
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