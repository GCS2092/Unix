import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminEnrollment } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { apiClient } from "../../api/client"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { panel } from "../../components/admin/PageHeader"
import { IconButton, Pill, Svg } from "../../components/admin/ui"
import { Avatar, Hero, ICON, ProgressBar, SearchBox, Segmented, heroBtnGhost } from "../../components/admin/formationUi"

export default function AdminEnrollmentsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [exporting, setExporting] = useState(false)

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

  async function handleExport() {
    setExporting(true)
    try {
      const res = await apiClient.get("/admin/enrollments/export", { params: { q, status }, responseType: "blob" })
      saveBlob(res.data, `inscriptions-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const date = (d: string) => new Date(d).toLocaleDateString(locale)

  const statusPill = (e: AdminEnrollment) => (
    <Pill tone={e.completed ? "success" : "info"} dot>
      {e.completed ? t("admin.completed", { defaultValue: "Terminé" }) : t("admin.in_progress", { defaultValue: "En cours" })}
    </Pill>
  )

  const actions = (e: AdminEnrollment) => (
    <div className="flex items-center gap-1.5">
      {e.certificate_id && (
        <IconButton label={t("admin.download", { defaultValue: "Télécharger" })} onClick={() => void handleDownload(e)}>
          <Svg d={ICON.download} className="h-4 w-4" />
        </IconButton>
      )}
      {e.completed && (
        <IconButton
          label={e.certificate_id ? t("admin.reissue", { defaultValue: "Réémettre" }) : t("admin.issue", { defaultValue: "Émettre" })}
          onClick={() => handleReissue(e)} disabled={reissue.isPending}
        >
          <Svg d={ICON.award} className="h-4 w-4" />
        </IconButton>
      )}
      <IconButton label={t("admin.remove_enrollment", { defaultValue: "Retirer" })} danger onClick={() => handleRemove(e)} disabled={remove.isPending}>
        <Svg d={ICON.trash} className="h-4 w-4" />
      </IconButton>
    </div>
  )

  return (
    <div>
      <Hero
        title={t("admin.enrollments", { defaultValue: "Inscriptions" })}
        count={data?.meta.total}
        subtitle={t("px.enr.hero", { defaultValue: "Suivez la progression de vos élèves et délivrez les certificats." })}
        actions={
          <button type="button" onClick={() => void handleExport()} disabled={exporting} className={heroBtnGhost}>
            <Svg d={ICON.download} className="h-4 w-4" />
            {exporting ? t("admin.exporting", { defaultValue: "Export…" }) : t("admin.export_xlsx", { defaultValue: "Exporter (Excel)" })}
          </button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox
          tour="en-search" value={input} onChange={setInput}
          placeholder={t("admin.search_enrollments", { defaultValue: "Élève, e-mail ou cours" })}
        />
        <Segmented
          tour="en-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }}
          items={[
            { id: "", label: t("admin.enr_all", { defaultValue: "Tous" }) },
            { id: "in_progress", label: t("admin.in_progress", { defaultValue: "En cours" }) },
            { id: "completed", label: t("admin.completed", { defaultValue: "Terminé" }) },
            { id: "to_certify", label: t("admin.to_certify", { defaultValue: "À certifier" }) },
          ]}
        />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_enrollments", { defaultValue: "Aucune inscription." })} />}

      {data && data.data.length > 0 && (
        <>
          <ul className="stagger space-y-3 md:hidden">
            {data.data.map((e) => (
              <li key={e.id} className={panel}>
                <div className="flex items-start gap-3">
                  <Avatar name={e.user_name ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.user_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted">{e.user_email ?? ""}</p>
                  </div>
                  {statusPill(e)}
                </div>
                <p className="mt-3 text-sm font-medium">{e.course_title ?? "—"}</p>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={e.progress} />
                  <span className="shrink-0 text-xs font-semibold text-muted">{e.progress} %</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {date(e.created_at)}{e.certificate_issued_at ? ` · ${t("admin.certificate", { defaultValue: "Certificat" })} ${date(e.certificate_issued_at)}` : ""}
                </p>
                <div className="mt-3 flex justify-end border-t border-line pt-3">{actions(e)}</div>
              </li>
            ))}
          </ul>

          <div data-tour="en-table" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page/70 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.student", { defaultValue: "Élève" })}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.course", { defaultValue: "Cours" })}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.progress", { defaultValue: "Progression" })}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.certificate", { defaultValue: "Certificat" })}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.col_date")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((e) => (
                  <tr key={e.id} className="transition hover:bg-primary/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.user_name ?? "?"} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold">{e.user_name ?? "—"}</p>
                          <p className="text-xs text-muted">{e.user_email ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{e.course_title ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24"><ProgressBar value={e.progress} /></div>
                        <span className="w-9 text-xs font-semibold text-muted">{e.progress} %</span>
                        {statusPill(e)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e.certificate_issued_at ? <Pill tone="success">{date(e.certificate_issued_at)}</Pill> : <span className="text-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{date(e.created_at)}</td>
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