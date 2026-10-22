import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { certificatesAdminApi, type CertRow, type CertStatus } from "../../api/certificatesAdmin"
import { useCertificateActions } from "../../hooks/useCertificateActions"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import Pagination from "../../components/Pagination"
import CertificatesByStudent from "../../components/admin/CertificatesByStudent"
import { Pill } from "../../components/admin/ui"
import { Avatar } from "../../components/admin/formationUi"
import CertificateCorrectModal from "../../components/admin/CertificateCorrectModal"

const inputClass =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"

const tone = { ready: "info", blocked: "warn", issued: "success", in_progress: "neutral" } as const

function fmtDate(d: string | null | undefined, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-"
}

function ByStatus({ tab, setTab, courseId, q, locale }: { tab: CertStatus; setTab: (t: CertStatus) => void; courseId: string; q: string; locale: string }) {
  const { t, i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const actions = useCertificateActions()
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<number[]>([])
  const [fixing, setFixing] = useState<number | null>(null)

  const filters = { course_id: courseId ? Number(courseId) : undefined, q: q || undefined }

  const list = useQuery({
    queryKey: ["admin-certificates", tab, courseId, q, page],
    queryFn: async () => (await certificatesAdminApi.list({ status: tab, ...filters, page })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const rows = list.data?.data ?? []
  const meta = list.data?.meta
  const certIds = rows.filter((r) => r.certificate_id).map((r) => r.id)
  const emailed = useQuery({
    queryKey: ["cert-emailed", certIds],
    queryFn: async () => (await certificatesAdminApi.emailed(certIds)).data.data,
    enabled: certIds.length > 0,
    staleTime: 0,
  })

  const refresh = () => {
    for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments", "cert-emailed"]) void qc.invalidateQueries({ queryKey: [k] })
  }

  const reissue = useMutation({
    mutationFn: (e: CertRow) => adminApi.reissueCertificate(e.id),
    onSuccess: () => { toast.success(L("Certificat généré", "Certificate generated")); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const grant = useMutation({
    mutationFn: (e: CertRow) => certificatesAdminApi.grantAttempt(e.id),
    onSuccess: () => { toast.success(L("Tentative supplémentaire accordée", "Extra attempt granted")); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const selectable = rows.filter((r) => r.status === "ready" || r.status === "issued")
  const allPage = selectable.length > 0 && selectable.every((r) => sel.includes(r.id))
  const toggle = (id: number) => setSel((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const busy = actions.busy !== null || reissue.isPending || grant.isPending

  async function selectAllReady() {
    try {
      const { data } = await certificatesAdminApi.readyIds(filters)
      setSel(data.data)
      if (data.total > data.data.length) toast.info(L("Seuls les 500 premiers sont sélectionnés.", "Only the first 500 are selected."))
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function run(fn: () => Promise<void>) {
    await fn()
    setSel([])
  }

  function handleReissue(e: CertRow) {
    if (e.certificate_id && !window.confirm(L(`Régénérer le certificat de ${e.user_name ?? ""} ? L'ancien fichier sera remplacé.`, `Regenerate ${e.user_name ?? ""}'s certificate? The old file will be replaced.`))) return
    reissue.mutate(e)
  }
  function handleGrant(e: CertRow) {
    if (window.confirm(L(`Accorder une tentative supplémentaire à ${e.user_name ?? ""} pour l'examen de « ${e.course_title ?? ""} » ?`, `Grant an extra attempt to ${e.user_name ?? ""}?`))) grant.mutate(e)
  }

  const tabs: { id: CertStatus; label: string; hint: string }[] = [
    { id: "ready", label: t("fx.cert.tab_ready", { defaultValue: "Prêts à émettre" }), hint: t("fx.cert.hint_ready", { defaultValue: "Cours terminé et examen validé (ou cours sans examen), certificat pas encore émis." }) },
    { id: "blocked", label: t("fx.cert.tab_blocked", { defaultValue: "Examen non réussi" }), hint: t("fx.cert.hint_blocked", { defaultValue: "Cours terminé mais examen final pas encore réussi : le certificat est impossible tant que l'examen n'est pas validé." }) },
    { id: "issued", label: t("fx.cert.tab_issued", { defaultValue: "Délivrés" }), hint: t("fx.cert.hint_issued", { defaultValue: "Certificats déjà émis : téléchargement, envoi ou réémission." }) },
    { id: "in_progress", label: t("fx.cert.tab_progress", { defaultValue: "En cours" }), hint: t("fx.cert.hint_progress", { defaultValue: "Cours pas encore terminé." }) },
  ]
  const active = tabs.find((x) => x.id === tab)
  const pct = actions.progress ? Math.round((actions.progress.done / actions.progress.total) * 100) : 0
  const stamp = (iso: string) => new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map((x) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={tab === x.id}
            onClick={() => { setTab(x.id); setPage(1); setSel([]) }}
            className={`rounded-card border p-3 text-left transition ${tab === x.id ? "border-primary bg-primary/5" : "border-line bg-surface hover:border-primary/50"}`}
          >
            <span className="block text-2xl font-extrabold">{list.data?.counts[x.id] ?? 0}</span>
            <span className="block text-xs font-medium text-muted">{x.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {active && <p className="text-sm text-muted">{active.hint}</p>}
        {tab === "ready" && (
          <button type="button" onClick={() => void selectAllReady()} disabled={busy || (list.data?.counts.ready ?? 0) === 0} className={btnGhost}>
            {L("Sélectionner tous les prêts", "Select all ready")}
          </button>
        )}
      </div>

      {(selectable.length > 0 || sel.length > 0) && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-primary/30 bg-surface/95 p-3 shadow-card backdrop-blur">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox" className="h-5 w-5" disabled={busy} checked={allPage}
              onChange={() => setSel(allPage ? [] : Array.from(new Set([...sel, ...selectable.map((r) => r.id)])))}
            />
            {sel.length > 0 ? L(`${sel.length} sélectionné(s)`, `${sel.length} selected`) : L("Sélectionner la page", "Select page")}
          </label>
          {sel.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              {tab === "ready" && (
                <button type="button" disabled={busy} onClick={() => void run(() => actions.issue(sel))} className={btnPrimary}>
                  {L("Émettre la sélection", "Issue selected")}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void run(() => actions.download(sel, "certificats"))} className={btnGhost}>
                {sel.length > 1 ? L("Télécharger en ZIP", "Download ZIP") : L("Générer le PDF", "Generate PDF")}
              </button>
              <button type="button" disabled={busy} onClick={() => void run(() => actions.send(sel, null))} className={tab === "ready" ? btnGhost : btnPrimary}>
                {L("Envoyer par e-mail", "Send by email")}
              </button>
              <button type="button" disabled={busy} onClick={() => setSel([])} className="min-h-[40px] px-2 text-sm font-semibold text-muted hover:text-ink">
                {L("Désélectionner", "Clear")}
              </button>
            </div>
          )}
          {actions.progress && (
            <div className="basis-full" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{actions.progress.done} / {actions.progress.total}</p>
            </div>
          )}
        </div>
      )}

      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.isLoading && <Skeleton className="h-48" />}

      {list.data && rows.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
          {t("fx.cert.empty", { defaultValue: "Aucun élève dans cet onglet." })}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4 shadow-card">
          {rows.map((e) => {
            const can = e.status === "ready" || e.status === "issued"
            const sentAt = emailed.data?.[e.id]
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox" className="h-5 w-5 flex-none" disabled={!can || busy}
                    checked={sel.includes(e.id)} onChange={() => toggle(e.id)} aria-label={e.user_name ?? ""}
                  />
                  <Avatar name={e.user_name ?? "?"} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{e.user_name ?? "-"}</span>
                    <span className="block truncate text-xs text-muted">{e.user_email} · {e.course_title ?? "-"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {e.status === "ready" && <Pill tone={tone.ready}>{tabs[0].label}</Pill>}
                      {e.status === "blocked" && <Pill tone={tone.blocked}>{tabs[1].label}</Pill>}
                      {e.status === "issued" && <Pill tone={tone.issued}>{L("Certificat", "Certificate")} {fmtDate(e.certificate_issued_at, locale)}</Pill>}
                      {e.status === "in_progress" && <Pill tone={tone.in_progress}>{e.progress} %</Pill>}
                      {sentAt && <span className="text-xs font-medium text-emerald-700">{L("Envoyé le", "Sent on")} {stamp(sentAt)}</span>}
                      {e.completed && e.completed_at && <span className="text-xs text-muted">{L("Terminé le", "Completed on")} {fmtDate(e.completed_at, locale)}</span>}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {can && (
                    <>
                      <button type="button" disabled={busy} onClick={() => void actions.download([e.id], `${e.user_name ?? ""}-${e.course_title ?? ""}`)} className={btnGhost}>
                        {L("Générer le PDF", "Generate PDF")}
                      </button>
                      <button type="button" disabled={busy} onClick={() => void actions.send([e.id], e.user_email)} className={sentAt ? btnGhost : btnPrimary}>
                        {sentAt ? L("Renvoyer", "Resend") : L("Envoyer par e-mail", "Send by email")}
                      </button>
                    </>
                  )}
                  {e.status === "issued" && (
                    <button type="button" disabled={busy} onClick={() => handleReissue(e)} className={btnGhost}>
                      {t("admin.reissue", { defaultValue: "Réémettre" })}
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => setFixing(e.id)} className={btnGhost}>
                    {L("Corriger les infos", "Correct details")}
                  </button>
                  {e.status === "blocked" && e.exam_required && (
                    <button type="button" disabled={busy} onClick={() => handleGrant(e)} className={btnGhost}>
                      {L("Accorder une tentative", "Grant an attempt")}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {meta && <Pagination meta={meta} onChange={(p) => { setPage(p); setSel([]) }} />}
      {fixing !== null && <CertificateCorrectModal enrollmentId={fixing} onClose={() => setFixing(null)} />}
    </div>
  )
}

export default function AdminCertificatesPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [view, setView] = useState<"student" | "status">("status")
  const [tab, setTab] = useState<CertStatus>("ready")
  const [courseId, setCourseId] = useState("")
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350)
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

  const views: { id: "student" | "status"; label: string }[] = [
    { id: "status", label: t("fx.cert.view_status", { defaultValue: "Par statut" }) },
    { id: "student", label: t("fx.cert.view_students", { defaultValue: "Par élève" }) },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("fx.cert.title", { defaultValue: "Certificats" })}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("fx.cert.intro", { defaultValue: "Émettez, téléchargez et envoyez les certificats de tous les cours, un par un ou en lot. Les nouveaux cours apparaissent ici automatiquement." })}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={t("fx.cert.title", { defaultValue: "Certificats" })} className="inline-flex w-fit rounded-full border border-line bg-surface p-1">
          {views.map((v) => (
            <button
              key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
              className={`min-h-[36px] rounded-full px-4 text-sm font-semibold transition ${view === v.id ? "bg-primary text-white" : "text-muted hover:text-ink"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={t("fx.cert.search", { defaultValue: "Nom, e-mail ou cours" })}
            className={`${inputClass} w-full sm:w-64`}
          />
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${inputClass} w-full sm:w-64`}>
            <option value="">{t("px.rq.all_courses", { defaultValue: "Tous les cours" })}</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </div>

      {view === "student"
        ? <CertificatesByStudent key={`${courseId}|${q}`} courseId={courseId} q={q} locale={locale} />
        : <ByStatus key={`${courseId}|${q}`} tab={tab} setTab={setTab} courseId={courseId} q={q} locale={locale} />}
    </div>
  )
}