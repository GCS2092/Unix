import { useEffect, useState, type ReactNode } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { enrollmentRequestsApi, type RequestStatus } from "../../api/enrollmentRequests"
import { requestsAdminApi } from "../../api/requestsAdmin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import { Drawer, Pill } from "../../components/admin/ui"
import { Avatar } from "../../components/admin/formationUi"
import { ageFrom } from "../../lib/geo"
import { saveBlob } from "../../lib/download"
import { usersAdminApi } from "../../api/usersAdmin"
import AdminUserProfileModal from "../../components/admin/AdminUserProfileModal"

const inputClass =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const btnDanger =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold text-danger transition hover:bg-danger/5 active:scale-95 disabled:opacity-50"

const statusTone = { pending: "warn", approved: "success", rejected: "danger" } as const

function useRefresh() {
  const qc = useQueryClient()
  return () => {
    for (const k of ["admin-requests", "admin-request", "admin-enrollment-requests", "admin-formations", "admin-enrollments"]) {
      void qc.invalidateQueries({ queryKey: [k] })
    }
  }
}

function useDecide() {
  const { t } = useTranslation()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (v: { id: number; action: "approve" | "reject"; note?: string }) =>
      enrollmentRequestsApi.decide(v.id, v.action, v.note),
    onSuccess: (_r, v) => {
      toast.success(
        v.action === "approve"
          ? t("px.req.approved", { defaultValue: "Demande acceptée, l'étudiant est inscrit." })
          : t("px.req.refused", { defaultValue: "Demande refusée." }),
      )
      refresh()
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      refresh()
    },
  })
}

function fmtDate(d: string | null | undefined, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-"
}

function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return "-"
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3.5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  )
}

function DetailPanel({ id, locale }: { id: number; locale: string }) {
  const { t } = useTranslation()
  const refresh = useRefresh()
  const [note, setNote] = useState("")
  const decide = useDecide()

  const statusLabel = (s: RequestStatus) =>
    s === "pending"
      ? t("px.req.tab_pending", { defaultValue: "En attente" })
      : s === "approved"
        ? t("px.req.tab_approved", { defaultValue: "Acceptées" })
        : t("px.req.tab_rejected", { defaultValue: "Refusées" })

  const detail = useQuery({
    queryKey: ["admin-request", id],
    queryFn: async () => (await requestsAdminApi.show(id)).data.data,
    staleTime: 0,
  })

  const resendDecision = useMutation({
    mutationFn: () => requestsAdminApi.resendDecision(id),
    onSuccess: () => toast.success(t("px.rq.mail_sent", { defaultValue: "E-mail de décision renvoyé." })),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const resendLink = useMutation({
    mutationFn: (type: "verify" | "password") => requestsAdminApi.resendLink(id, type),
    onSuccess: (_r, type) =>
      toast.success(
        type === "verify"
          ? t("px.rq.verify_sent", { defaultValue: "Lien de vérification envoyé." })
          : t("px.rq.password_sent", { defaultValue: "Lien de mot de passe envoyé." }),
      ),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const removeEnrollment = useMutation({
    mutationFn: (enrollmentId: number) => requestsAdminApi.removeEnrollment(enrollmentId),
    onSuccess: () => {
      toast.success(t("px.rq.removed", { defaultValue: "Inscription retirée." }))
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const [editing, setEditing] = useState(false)
  const targetId = (detail.data?.user as unknown as { id?: number } | null | undefined)?.id
  const verifyNow = useMutation({
    mutationFn: (uid: number) => usersAdminApi.verifyEmail(uid),
    onSuccess: () => { toast.success(t("px.rq.verified_now", { defaultValue: "E-mail marqué comme vérifié." })); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (detail.isLoading) return <Skeleton className="h-64" />
  if (detail.error || !detail.data) {
    return <ErrorState error={detail.error ?? new Error("Introuvable")} onRetry={() => void detail.refetch()} />
  }

  const d = detail.data
  const u = d.user
  const enrollmentId = d.enrollment_id
  const busy = decide.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u?.name ?? "?"} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{u?.name ?? "-"}</p>
            <p className="truncate text-sm text-muted">{d.course.title ?? "-"}</p>
          </div>
        </div>
        <Pill tone={statusTone[d.status]} dot>{statusLabel(d.status)}</Pill>
      </div>

      {u && (
        <Block title={t("px.rq.person", { defaultValue: "Personne" })}>
          <dl>
            <Field label={t("px.fm.email", { defaultValue: "E-mail" })}>
              {u.email}{" "}
              {u.email_verified
                ? <Pill tone="success">{t("px.rq.verified", { defaultValue: "Vérifié" })}</Pill>
                : <Pill tone="warn">{t("px.rq.not_verified", { defaultValue: "Non vérifié" })}</Pill>}
            </Field>
            <Field label={t("px.rq.phone", { defaultValue: "Téléphone" })}>{u.phone ?? "-"}</Field>
            <Field label={t("px.rq.gender", { defaultValue: "Sexe" })}>
              {u.gender === "male"
                ? t("px.signup.male", { defaultValue: "Homme" })
                : u.gender === "female"
                  ? t("px.signup.female", { defaultValue: "Femme" })
                  : "-"}
            </Field>
            <Field label={t("px.rq.birth_date", { defaultValue: "Date de naissance" })}>
              {u.birth_date
                ? `${fmtDate(u.birth_date, locale)} (${t("px.rq.years", { defaultValue: "{{n}} ans", n: ageFrom(u.birth_date) ?? "?" })})`
                : "-"}
            </Field>
            <Field label={t("px.rq.birth_place", { defaultValue: "Lieu de naissance" })}>
              {u.birth_place || u.birth_country
                ? [u.birth_place, u.birth_country ? countryName(u.birth_country, locale) : null].filter(Boolean).join(", ")
                : "-"}
            </Field>
            <Field label={t("px.rq.nationality", { defaultValue: "Nationalité" })}>{countryName(u.nationality, locale)}</Field>
            <Field label={t("px.rq.residence", { defaultValue: "Résidence" })}>
              {u.city || u.country
                ? [u.city, u.country ? countryName(u.country, locale) : null].filter(Boolean).join(", ")
                : "-"}
            </Field>
            <Field label={t("px.rq.address", { defaultValue: "Adresse" })}>{u.address || "-"}</Field>
            <Field label={t("px.rq.profession", { defaultValue: "Profession / études" })}>{u.profession || "-"}</Field>
            <Field label={t("px.rq.account_since", { defaultValue: "Compte créé le" })}>{fmtDate(u.created_at, locale)}</Field>
            <Field label={t("px.rq.status", { defaultValue: "Statut" })}>
              {u.is_student ? <Pill tone="info">{t("px.fm.student", { defaultValue: "Étudiant" })}</Pill> : "-"}{" "}
              {u.is_blocked && <Pill tone="danger">{t("px.rq.blocked", { defaultValue: "Compte bloqué" })}</Pill>}
            </Field>
            <Field label={t("px.rq.requested_on", { defaultValue: "Demande du" })}>{fmtDate(d.created_at, locale)}</Field>
          </dl>
        </Block>
      )}

      {d.message && (
        <Block title={t("px.rq.student_message", { defaultValue: "Message de l'étudiant" })}>
          <p className="whitespace-pre-line text-sm">{d.message}</p>
        </Block>
      )}

      {d.status !== "pending" && (
        <Block title={t("px.rq.decision", { defaultValue: "Décision" })}>
          <p className="text-sm">
            {statusLabel(d.status)} · {fmtDate(d.decided_at, locale)}
            {d.decided_by_name ? ` · ${d.decided_by_name}` : ""}
          </p>
          {d.decision_note && <p className="mt-1 text-sm text-muted">{d.decision_note}</p>}
          {d.status === "approved" && (
            <p className="mt-1 text-xs text-muted">
              {enrollmentId !== null
                ? t("px.rq.enrolled_now", { defaultValue: "Inscription active." })
                : t("px.rq.not_enrolled", { defaultValue: "La personne n'est plus inscrite à ce cours." })}
            </p>
          )}
        </Block>
      )}

      <Block title={`${t("px.rq.orders", { defaultValue: "Commandes" })} (${d.orders_count})`}>
        {d.orders.length === 0 ? (
          <p className="text-sm text-muted">{t("px.rq.no_orders", { defaultValue: "Aucune commande." })}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.orders.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-1.5">
                <span>#{o.id}</span>
                <span className="text-muted">{o.status ?? "-"} · {fmtDate(o.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={`${t("px.rq.enrollments", { defaultValue: "Inscriptions" })} (${d.enrollments.length})`}>
        {d.enrollments.length === 0 ? (
          <p className="text-sm text-muted">{t("px.rq.no_enrollments", { defaultValue: "Aucune inscription." })}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.enrollments.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{e.course_title ?? "-"}</span>
                <span className="shrink-0 text-muted">{e.completed ? "100 %" : `${e.progress} %`}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {d.other_requests.length > 0 && (
        <Block title={t("px.rq.other_requests", { defaultValue: "Autres demandes" })}>
          <ul className="divide-y divide-line text-sm">
            {d.other_requests.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{o.course_title ?? "-"}</span>
                <Pill tone={statusTone[o.status]}>{statusLabel(o.status)}</Pill>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={t("px.rq.actions", { defaultValue: "Actions" })}>
        {d.status === "pending" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              {t("px.rq.note_label", { defaultValue: "Message ou motif (facultatif, envoyé à l'étudiant)" })}
              <textarea
                rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={btnPrimary}
                onClick={() => decide.mutate({ id, action: "approve", note: note.trim() || undefined })}>
                {t("px.req.accept", { defaultValue: "Accepter" })}
              </button>
              <button type="button" disabled={busy} className={btnDanger}
                onClick={() => decide.mutate({ id, action: "reject", note: note.trim() || undefined })}>
                {t("px.req.reject", { defaultValue: "Refuser" })}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resendDecision.isPending} className={btnGhost}
              onClick={() => resendDecision.mutate()}>
              {t("px.rq.resend_decision", { defaultValue: "Renvoyer l'e-mail de décision" })}
            </button>
            {d.status === "approved" && enrollmentId !== null && (
              <button type="button" disabled={removeEnrollment.isPending} className={btnDanger}
                onClick={() => {
                  if (window.confirm(t("px.rq.remove_confirm", { defaultValue: "Retirer cette inscription ?" }))) {
                    removeEnrollment.mutate(enrollmentId)
                  }
                }}>
                {t("px.rq.remove", { defaultValue: "Retirer l'inscription" })}
              </button>
            )}
          </div>
        )}

        {u && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {!u.email_verified && (
              <button type="button" disabled={resendLink.isPending} className={btnGhost}
                onClick={() => resendLink.mutate("verify")}>
                {t("px.rq.resend_verify", { defaultValue: "Renvoyer le lien de vérification" })}
              </button>
            )}
            <button type="button" disabled={resendLink.isPending} className={btnGhost}
              onClick={() => resendLink.mutate("password")}>
              {t("px.rq.send_password", { defaultValue: "Envoyer un lien de mot de passe" })}
            </button>
            <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
              {t("px.rq.edit_profile", { defaultValue: "Corriger les informations" })}
            </button>
            {!u.email_verified && targetId !== undefined && (
              <button type="button" disabled={verifyNow.isPending} className={btnGhost} onClick={() => verifyNow.mutate(targetId)}>
                {t("px.rq.mark_verified", { defaultValue: "Marquer l'e-mail comme vérifié" })}
              </button>
            )}
            {editing && targetId !== undefined && (
              <AdminUserProfileModal userId={targetId} initial={u as unknown as Record<string, string | null | undefined>} onClose={() => setEditing(false)} onSaved={refresh} />
            )}
          </div>
        )}
      </Block>
    </div>
  )
}

export default function AdminRequestsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [tab, setTab] = useState<RequestStatus>("pending")
  const [courseId, setCourseId] = useState("")
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  async function exportFile() {
    setExporting(true)
    try {
      const res = await requestsAdminApi.exportFile({ status: tab, course_id: courseId ? Number(courseId) : undefined, q: q || undefined })
      saveBlob(res.data, `demandes-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [input])

  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as { id: number; title: string }[]
    },
  })

  const list = useQuery({
    queryKey: ["admin-requests", tab, courseId, q, page],
    queryFn: async () =>
      (await requestsAdminApi.list({
        status: tab,
        course_id: courseId ? Number(courseId) : undefined,
        q: q || undefined,
        page,
      })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const tabs: { id: RequestStatus; label: string }[] = [
    { id: "pending", label: t("px.req.tab_pending", { defaultValue: "En attente" }) },
    { id: "approved", label: t("px.req.tab_approved", { defaultValue: "Acceptées" }) },
    { id: "rejected", label: t("px.req.tab_rejected", { defaultValue: "Refusées" }) },
  ]
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("px.req.title_all", { defaultValue: "Demandes d'inscription" })}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("px.rq.intro", { defaultValue: "Vérifiez la personne, puis acceptez ou refusez. L'étudiant est prévenu par e-mail." })}
        </p>
      </div>

      <div data-tour="rq-filters" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={t("px.rq.search", { defaultValue: "Nom, e-mail ou téléphone" })}
          className={`${inputClass} w-full sm:max-w-xs`}
        />
        <select
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setPage(1) }}
          className={`${inputClass} w-full sm:max-w-xs`}
        >
          <option value="">{t("px.rq.all_courses", { defaultValue: "Tous les cours" })}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button type="button" onClick={() => void exportFile()} disabled={exporting} className={btnGhost}>
          {exporting ? t("fx.rq.exporting", { defaultValue: "Export..." }) : t("fx.rq.export", { defaultValue: "Exporter (Excel)" })}
        </button>
      </div>

      <div role="tablist" data-tour="rq-tabs" className="flex gap-2 overflow-x-auto">
        {tabs.map((x) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={tab === x.id}
            onClick={() => { setTab(x.id); setPage(1) }}
            className={`min-h-[40px] whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
              tab === x.id ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {x.label} ({list.data?.counts[x.id] ?? 0})
          </button>
        ))}
      </div>

      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.isLoading && <Skeleton className="h-48" />}

      {list.data && rows.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
          {t("px.req.none_here", { defaultValue: "Aucune demande dans cet onglet." })}
        </p>
      )}

      {rows.length > 0 && (
        <ul data-tour="rq-list" className="divide-y divide-line rounded-card border border-line bg-surface px-4 shadow-card">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpenId(r.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 py-3 text-left sm:flex-nowrap">
                <span className="flex min-w-0 items-start gap-3">
                  <Avatar name={r.user_name ?? "?"} />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {r.user_name ?? "-"} <span className="font-normal text-muted">· {r.course_title ?? "-"}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {r.user_email}{r.user_phone ? ` · ${r.user_phone}` : ""} · {fmtDate(r.created_at, locale)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {!r.email_verified && <Pill tone="warn">{t("px.rq.not_verified", { defaultValue: "Non vérifié" })}</Pill>}
                      {r.user_blocked && <Pill tone="danger">{t("px.rq.blocked", { defaultValue: "Compte bloqué" })}</Pill>}
                      {r.message && <Pill tone="info">{t("px.rq.has_message", { defaultValue: "Message" })}</Pill>}
                    </span>
                  </span>
                </span>
                <Pill tone={statusTone[r.status]} dot>{tabs.find((x) => x.id === r.status)?.label}</Pill>
              </button>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={btnGhost}>←</button>
          <span className="text-muted">{meta.current_page} / {meta.last_page} · {meta.total}</span>
          <button type="button" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)} className={btnGhost}>→</button>
        </div>
      )}

      <Drawer open={openId !== null} title={t("px.rq.detail", { defaultValue: "Détail de la demande" })} onClose={() => setOpenId(null)}>
        {openId !== null && <DetailPanel key={openId} id={openId} locale={locale} />}
      </Drawer>
    </div>
  )
}



