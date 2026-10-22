import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Award, Check, CircleCheck, Clock, Download, FileArchive, MailCheck, Plus, Send, TriangleAlert } from "lucide-react"
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
import CertificateTemplatePanel from "../../components/admin/CertificateTemplatePanel"
import CertificateCorrectModal from "../../components/admin/CertificateCorrectModal"
import { btn, btnPrimary, closeMenu, fmtDate, Medal, MetaItem, menuItem, ProgressBar, RowMenu, stamp, Tile } from "../../components/admin/certUi"

const inputClass =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

const dots: Record<CertStatus, string> = { ready: "bg-primary", blocked: "bg-accent", issued: "bg-success", in_progress: "bg-muted" }

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
  const revoke = useMutation({
    mutationFn: (p: { e: CertRow; reason: string }) => certificatesAdminApi.revoke(p.e.id, p.reason),
    onSuccess: () => { toast.success(L("Certificat révoqué.", "Certificate revoked.")); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const restore = useMutation({
    mutationFn: (e: CertRow) => certificatesAdminApi.restore(e.id),
    onSuccess: () => { toast.success(L("Certificat rétabli.", "Certificate restored.")); refresh() },
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
  const busy = actions.busy !== null || reissue.isPending || grant.isPending || revoke.isPending || restore.isPending
  const readyCount = list.data?.counts.ready ?? 0
  // Certificats délivrés de la page qui n'ont pas encore été envoyés par e-mail
  const unsent = tab === "issued" ? rows.filter((r) => r.status === "issued" && !r.revoked && !emailed.data?.[r.id]).map((r) => r.id) : []

  async function selectAllReady() {
    try {
      const { data } = await certificatesAdminApi.readyIds(filters)
      setSel(data.data)
      if (data.total > data.data.length) toast.info(L("Seuls les 500 premiers sont sélectionnés.", "Only the first 500 are selected."))
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function issueAllReady() {
    try {
      const { data } = await certificatesAdminApi.readyIds(filters)
      if (data.data.length === 0) return
      if (!window.confirm(L(`Générer ${data.data.length} certificat(s) ?`, `Generate ${data.data.length} certificate(s)?`))) return
      await actions.issue(data.data)
      refresh()
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
  function handleRevoke(e: CertRow) {
    const reason = window.prompt(L(`Motif de la révocation du certificat de ${e.user_name ?? ""} (obligatoire) :`, `Reason for revoking ${e.user_name ?? ""}'s certificate (required):`))
    if (!reason || reason.trim().length < 3) return
    revoke.mutate({ e, reason: reason.trim() })
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

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tabs.map((x) => (
          <Tile
            key={x.id} tabId={x.id} active={tab === x.id} count={list.data?.counts[x.id] ?? 0} label={x.label} dot={dots[x.id]}
            onClick={() => { setTab(x.id); setPage(1); setSel([]) }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {active && <p className="text-sm text-muted">{active.hint}</p>}
        <div className="flex flex-wrap gap-2">
          {tab === "ready" && (
            <>
              <button type="button" onClick={() => void selectAllReady()} disabled={busy || readyCount === 0} className={btn}>
                {L("Sélectionner tous les prêts", "Select all ready")}
              </button>
              <button type="button" onClick={() => void issueAllReady()} disabled={busy || readyCount === 0} className={btnPrimary}>
                <Award className="h-4 w-4" aria-hidden="true" />{L(`Générer les ${readyCount} prêts`, `Generate the ${readyCount} ready`)}
              </button>
            </>
          )}
          {unsent.length > 0 && (
            <button type="button" disabled={busy} onClick={() => void actions.send(unsent, null)} className={btnPrimary}>
              <Send className="h-4 w-4" aria-hidden="true" />{L(`Envoyer les ${unsent.length} non envoyés`, `Send the ${unsent.length} unsent`)}
            </button>
          )}
        </div>
      </div>

      {(selectable.length > 0 || sel.length > 0) && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-surface/95 p-3 shadow-card backdrop-blur">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox" className="h-[18px] w-[18px] accent-primary" disabled={busy} checked={allPage}
              onChange={() => setSel(allPage ? [] : Array.from(new Set([...sel, ...selectable.map((r) => r.id)])))}
            />
            {sel.length > 0 ? L(`${sel.length} sélectionné(s)`, `${sel.length} selected`) : L("Sélectionner la page", "Select page")}
          </label>
          {sel.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-1.5">
              {tab === "ready" && (
                <button type="button" disabled={busy} onClick={() => void run(() => actions.issue(sel))} className={btnPrimary}>
                  <Award className="h-4 w-4" aria-hidden="true" />{L("Émettre la sélection", "Issue selected")}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void run(() => actions.download(sel, "certificats"))} className={btn}>
                <FileArchive className="h-4 w-4" aria-hidden="true" />
                {sel.length > 1 ? L("Télécharger (ZIP)", "Download (ZIP)") : L("Générer le PDF", "Generate PDF")}
              </button>
              <button type="button" disabled={busy} onClick={() => void run(() => actions.send(sel, null))} className={tab === "ready" ? btn : btnPrimary}>
                <Send className="h-4 w-4" aria-hidden="true" />{L("Envoyer par e-mail", "Send by email")}
              </button>
              <button type="button" disabled={busy} onClick={() => setSel([])} className="min-h-[36px] px-2 text-sm font-semibold text-muted hover:text-ink">
                {L("Désélectionner", "Clear")}
              </button>
            </div>
          )}
          {actions.progress && (
            <div className="basis-full" role="status">
              <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
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
        <ul className="space-y-2">
          {rows.map((e) => {
            const can = e.status === "ready" || e.status === "issued"
            const sentAt = emailed.data?.[e.id]
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
                <input
                  type="checkbox" className="h-[18px] w-[18px] flex-none accent-primary" disabled={!can || busy}
                  checked={sel.includes(e.id)} onChange={() => toggle(e.id)} aria-label={e.user_name ?? ""}
                />
                <Medal on={e.status === "issued"} locked={e.status === "blocked"} />

                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-sm font-semibold">{e.user_name ?? "-"}</p>
                  <p className="truncate text-xs text-muted">{e.user_email} · {e.course_title ?? "-"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {e.status === "ready" && <MetaItem icon={CircleCheck}>{L("Cours terminé, examen validé", "Course completed, exam passed")}</MetaItem>}
                    {e.status === "blocked" && <MetaItem icon={TriangleAlert}>{L("Examen final à réussir", "Final exam to pass")}</MetaItem>}
                    {e.status === "issued" && (
                      <>
                        <MetaItem icon={Check}>{L("Généré le", "Generated on")} {fmtDate(e.certificate_issued_at, locale)}</MetaItem>
                        {sentAt
                          ? <MetaItem icon={MailCheck}>{L("Envoyé le", "Sent on")} {stamp(sentAt, locale)}</MetaItem>
                          : <MetaItem icon={Clock}>{L("Pas encore envoyé", "Not sent yet")}</MetaItem>}
                      </>
                    )}
                    {e.status === "in_progress" && <ProgressBar value={e.progress} />}
                    {e.completed && e.completed_at && e.status !== "issued" && (
                      <span>{L("Terminé le", "Completed on")} {fmtDate(e.completed_at, locale)}</span>
                    )}
                  </p>
                </div>

                {e.status === "ready" && <Pill tone="info">{L("À générer", "To generate")}</Pill>}
                {e.status === "blocked" && <Pill tone="warn">{L("Examen non réussi", "Exam not passed")}</Pill>}
                {e.status === "issued" && (sentAt ? <Pill tone="success">{L("Envoyé", "Sent")}</Pill> : <Pill tone="warn">{L("À envoyer", "To send")}</Pill>)}
                {e.status === "in_progress" && <Pill tone="neutral">{L("En cours", "In progress")}</Pill>}
                {e.revoked && <Pill tone="danger">{L("Révoqué", "Revoked")}</Pill>}

                <div className="flex flex-wrap items-center gap-1.5">
                  {e.status === "ready" && (
                    <button type="button" disabled={busy} onClick={() => handleReissue(e)} className={btnPrimary}>
                      <Award className="h-4 w-4" aria-hidden="true" />{L("Générer", "Generate")}
                    </button>
                  )}
                  {e.status === "issued" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => void actions.download([e.id], `${e.user_name ?? ""}-${e.course_title ?? ""}`)} className={btn}>
                        <Download className="h-4 w-4" aria-hidden="true" />PDF
                      </button>
                      <button type="button" disabled={busy} onClick={() => void actions.send([e.id], e.user_email)} className={sentAt ? btn : btnPrimary}>
                        <Send className="h-4 w-4" aria-hidden="true" />{sentAt ? L("Renvoyer", "Resend") : L("Envoyer", "Send")}
                      </button>
                    </>
                  )}
                  {e.status === "blocked" && e.exam_required && (
                    <button type="button" disabled={busy} onClick={() => handleGrant(e)} className={btn}>
                      <Plus className="h-4 w-4" aria-hidden="true" />{L("Accorder une tentative", "Grant an attempt")}
                    </button>
                  )}
                  <RowMenu label={L("Plus d'actions", "More actions")}>
                    <button type="button" className={menuItem} disabled={busy} onClick={(ev) => { closeMenu(ev); setFixing(e.id) }}>
                      {L("Corriger les infos", "Correct details")}
                    </button>
                    {e.status === "issued" && (
                      <button type="button" className={menuItem} disabled={busy} onClick={(ev) => { closeMenu(ev); handleReissue(e) }}>
                        {t("admin.reissue", { defaultValue: "Réémettre" })}
                      </button>
                    )}
                    {e.certificate_id && (e.revoked
                      ? <button type="button" className={menuItem} disabled={busy} onClick={(ev) => { closeMenu(ev); restore.mutate(e) }}>{L("Rétablir", "Restore")}</button>
                      : <button type="button" className={`${menuItem} text-danger`} disabled={busy} onClick={(ev) => { closeMenu(ev); handleRevoke(e) }}>{L("Révoquer", "Revoke")}</button>)}
                  </RowMenu>
                </div>
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
  const [view, setView] = useState<"student" | "status" | "template">("student")
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

  const views: { id: "student" | "status" | "template"; label: string }[] = [
    { id: "student", label: t("fx.cert.view_students", { defaultValue: "Par élève" }) },
    { id: "status", label: t("fx.cert.view_status", { defaultValue: "Par statut" }) },
    { id: "template", label: t("fx.cert.view_template", { defaultValue: "Modèle" }) },
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
        {view !== "template" && (
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
        )}
      </div>

      {view === "template" ? <CertificateTemplatePanel /> : view === "student"
        ? <CertificatesByStudent key={`${courseId}|${q}`} courseId={courseId} q={q} locale={locale} />
        : <ByStatus key={`${courseId}|${q}`} tab={tab} setTab={setTab} courseId={courseId} q={q} locale={locale} />}
    </div>
  )
}