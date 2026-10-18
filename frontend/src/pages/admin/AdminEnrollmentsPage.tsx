import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminEnrollment } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { Badge, PageHeader, field, panel } from "../../components/admin/PageHeader"

function Progress({ value, done }: { value: number; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
        <div className={`h-full ${done ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs text-muted">{value}%</span>
    </div>
  )
}

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
    mutationFn: (e: AdminEnrollment) => adminApi.removeEnrollment(e.id),
    onSuccess: async () => {
      toast.success(t("admin.enrollment_removed", { defaultValue: "Inscription retirée" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-enrollments"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function handleRemove(e: AdminEnrollment) {
    const msg = t("admin.confirm_remove_enrollment", {
      defaultValue: "Retirer {{name}} du cours « {{course}} » ? Il perdra l'accès au cours et au direct.",
      name: e.user_name ?? "", course: e.course_title ?? "",
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

  const date = (d: string) => new Date(d).toLocaleDateString(locale)

  const actions = (e: AdminEnrollment) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {e.certificate_id && (
        <button type="button" onClick={() => void handleDownload(e)} className="min-h-[36px] font-semibold text-primary hover:underline">
          {t("admin.download", { defaultValue: "Télécharger" })}
        </button>
      )}
      {e.completed && (
        <button type="button" onClick={() => handleReissue(e)} disabled={reissue.isPending} className="min-h-[36px] font-semibold text-muted hover:text-ink disabled:opacity-50">
          {e.certificate_id ? t("admin.reissue", { defaultValue: "Réémettre" }) : t("admin.issue", { defaultValue: "Émettre" })}
        </button>
      )}
      <button type="button" onClick={() => handleRemove(e)} disabled={remove.isPending} className="min-h-[36px] font-semibold text-danger hover:underline disabled:opacity-50">
        {t("admin.remove_enrollment", { defaultValue: "Retirer" })}
      </button>
    </div>
  )

  return (
    <div>
      <PageHeader title={t("admin.enrollments", { defaultValue: "Inscriptions" })} count={data?.meta.total} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search" value={input} onChange={(e) => setInput(e.target.value)} data-tour="en-search"
          placeholder={t("admin.search_enrollments", { defaultValue: "Élève, e-mail ou cours" })}
          className={`${field} !mt-0 sm:max-w-sm`}
        />
        <select
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          data-tour="en-status" aria-label={t("admin.col_status")} className={`${field} !mt-0 sm:w-56`}
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
        <>
          <ul className="space-y-3 md:hidden">
            {data.data.map((e) => (
              <li key={e.id} className={panel}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.user_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted">{e.user_email ?? ""}</p>
                  </div>
                  {e.completed && <Badge tone="success">{t("admin.completed", { defaultValue: "Terminé" })}</Badge>}
                </div>
                <p className="mt-2 text-sm">{e.course_title ?? "—"}</p>
                <div className="mt-2"><Progress value={e.progress} done={e.completed} /></div>
                <p className="mt-2 text-xs text-muted">
                  {date(e.created_at)}{e.certificate_issued_at ? ` · ${t("admin.certificate", { defaultValue: "Certificat" })} ${date(e.certificate_issued_at)}` : ""}
                </p>
                <div className="mt-2 border-t border-line pt-2">{actions(e)}</div>
              </li>
            ))}
          </ul>

          <div data-tour="en-table" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
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
                  <tr key={e.id} className="transition hover:bg-page/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.user_name ?? "—"}</p>
                      <p className="text-muted">{e.user_email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">{e.course_title ?? "—"}</td>
                    <td className="px-4 py-3"><Progress value={e.progress} done={e.completed} /></td>
                    <td className="px-4 py-3">
                      {e.certificate_issued_at ? <Badge tone="success">{date(e.certificate_issued_at)}</Badge> : <span className="text-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{date(e.created_at)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end">{actions(e)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}
