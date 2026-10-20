import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { enrollmentRequestsApi, type RequestStatus } from "../../api/enrollmentRequests"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { Pill } from "../../components/admin/ui"
import { Avatar } from "../../components/admin/formationUi"

export default function EnrollmentRequestsCard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const qc = useQueryClient()
  const [tab, setTab] = useState<Exclude<RequestStatus, never>>("pending")

  const list = useQuery({
    queryKey: ["admin-enrollment-requests"],
    queryFn: async () => (await enrollmentRequestsApi.adminList("all")).data.data,
    staleTime: 0,
  })

  const decide = useMutation({
    mutationFn: (v: { id: number; action: "approve" | "reject"; note?: string }) => enrollmentRequestsApi.decide(v.id, v.action, v.note),
    onSuccess: (_res, v) => {
      toast.success(
        v.action === "approve"
          ? t("px.req.approved", { defaultValue: "Demande acceptée, l'étudiant est inscrit." })
          : t("px.req.refused", { defaultValue: "Demande refusée." }),
      )
      void qc.invalidateQueries({ queryKey: ["admin-enrollment-requests"] })
      void qc.invalidateQueries({ queryKey: ["admin-formations"] })
      void qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      void qc.invalidateQueries({ queryKey: ["admin-enrollment-requests"] })
    },
  })

  const all = list.data ?? []
  if (all.length === 0) return null

  const count = (s: RequestStatus) => all.filter((r) => r.status === s).length
  const rows = all.filter((r) => r.status === tab)
  const tabs: { id: RequestStatus; label: string }[] = [
    { id: "pending", label: t("px.req.tab_pending", { defaultValue: "En attente" }) },
    { id: "approved", label: t("px.req.tab_approved", { defaultValue: "Acceptées" }) },
    { id: "rejected", label: t("px.req.tab_rejected", { defaultValue: "Refusées" }) },
  ]

  return (
    <section className="rounded-card border border-accent/50 bg-accent/5 p-4 shadow-card sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        {t("px.req.title_all", { defaultValue: "Demandes d'inscription" })}
        {count("pending") > 0 && <Pill tone="warn" dot>{count("pending")}</Pill>}
      </h3>

      <div role="tablist" className="mb-3 flex gap-2 overflow-x-auto">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`min-h-[36px] whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${
              tab === x.id ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {x.label} ({count(x.id)})
          </button>
        ))}
      </div>

      {rows.length === 0 && <p className="py-3 text-sm text-muted">{t("px.req.none_here", { defaultValue: "Aucune demande dans cet onglet." })}</p>}

      <ul className="divide-y divide-accent/20 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar name={r.user_name ?? "?"} />
              <div className="min-w-0">
                <p className="font-semibold">{r.user_name ?? "-"} <span className="font-normal text-muted">&middot; {r.course_title ?? "-"}</span></p>
                <p className="truncate text-xs text-muted">
                  {r.user_email}{r.user_phone ? ` · ${r.user_phone}` : ""} &middot; {new Date(r.created_at).toLocaleDateString(locale)}
                  {r.decided_at ? ` · ${t("px.req.decided_on", { defaultValue: "traitée le" })} ${new Date(r.decided_at).toLocaleDateString(locale)}` : ""}
                </p>
                {r.message && <p className="mt-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs">{r.message}</p>}
                {r.status === "rejected" && r.decision_note && (
                  <p className="mt-1 text-xs text-danger">{t("px.req.reason", { defaultValue: "Motif :" })} {r.decision_note}</p>
                )}
              </div>
            </div>
            {r.status === "pending" ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button" disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: r.id, action: "approve" })}
                  className="min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
                >
                  {t("px.req.accept", { defaultValue: "Accepter" })}
                </button>
                <button
                  type="button" disabled={decide.isPending}
                  onClick={() => {
                    const note = window.prompt(t("px.req.reject_reason", { defaultValue: "Motif du refus (facultatif, visible par l'élève)" }), "")
                    if (note === null) return
                    decide.mutate({ id: r.id, action: "reject", note: note.trim() || undefined })
                  }}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold text-danger transition hover:bg-danger/5 active:scale-95 disabled:opacity-50"
                >
                  {t("px.req.reject", { defaultValue: "Refuser" })}
                </button>
              </div>
            ) : (
              <Pill tone={r.status === "approved" ? "success" : "danger"} dot>
                {r.status === "approved" ? t("px.req.tab_approved", { defaultValue: "Acceptées" }) : t("px.req.tab_rejected", { defaultValue: "Refusées" })}
              </Pill>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}