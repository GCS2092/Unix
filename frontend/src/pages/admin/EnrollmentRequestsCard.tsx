import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { enrollmentRequestsApi } from "../../api/enrollmentRequests"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { Pill } from "../../components/admin/ui"
import { Avatar } from "../../components/admin/formationUi"

export default function EnrollmentRequestsCard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ["admin-enrollment-requests"],
    queryFn: async () => (await enrollmentRequestsApi.adminList("pending")).data.data,
    staleTime: 0,
  })

  const decide = useMutation({
    mutationFn: (v: { id: number; action: "approve" | "reject" }) => enrollmentRequestsApi.decide(v.id, v.action),
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

  const rows = list.data ?? []
  if (rows.length === 0) return null

  return (
    <section className="rounded-card border border-accent/50 bg-accent/5 p-4 shadow-card sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        {t("px.req.title", { defaultValue: "Demandes d'accès en attente" })}
        <Pill tone="warn" dot>{rows.length}</Pill>
      </h3>
      <ul className="divide-y divide-accent/20 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar name={r.user_name ?? "?"} />
              <div className="min-w-0">
                <p className="font-semibold">{r.user_name ?? "-"} <span className="font-normal text-muted">&middot; {r.course_title ?? "-"}</span></p>
                <p className="truncate text-xs text-muted">
                  {r.user_email}{r.user_phone ? ` · ${r.user_phone}` : ""} &middot; {new Date(r.created_at).toLocaleDateString(locale)}
                </p>
                {r.message && <p className="mt-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs">{r.message}</p>}
              </div>
            </div>
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
                onClick={() => decide.mutate({ id: r.id, action: "reject" })}
                className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold text-danger transition hover:bg-danger/5 active:scale-95 disabled:opacity-50"
              >
                {t("px.req.reject", { defaultValue: "Refuser" })}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}