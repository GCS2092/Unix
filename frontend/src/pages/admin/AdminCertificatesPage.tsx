import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { certificatesAdminApi, type CertRow, type CertStatus } from "../../api/certificatesAdmin"
import { useCertificateActions } from "../../hooks/useCertificateActions"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import Pagination from "../../components/Pagination"
import CertificatesByStudent from "../../components/admin/CertificatesByStudent"
import { Pill } from "../../components/admin/ui"
import { Avatar } from "../../components/admin/formationUi"

const inputClass =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"

const tone = { ready: "info", blocked: "warn", issued: "success", in_progress: "neutral" } as const
const CHUNK = 10

function fmtDate(d: string | null | undefined, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-"
}

function ByStatus({ tab, setTab, courseId, q, locale }: { tab: CertStatus; setTab: (t: CertStatus) => void; courseId: string; q: string; locale: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const actions = useCertificateActions()
  const [page, setPage] = useState(1)
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)

  const filters = { course_id: courseId ? Number(courseId) : undefined, q: q || undefined }

  const list = useQuery({
    queryKey: ["admin-certificates", tab, courseId, q, page],
    queryFn: async () => (await certificatesAdminApi.list({ status: tab, ...filters, page })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const refresh = () => {
    for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments"]) void qc.invalidateQueries({ queryKey: [k] })
  }

  const issueOne = useMutation({
    mutationFn: (e: CertRow) => adminApi.reissueCertificate(e.id),
    onSuccess: () => {
      toast.success(t("admin.certificate_ok", { defaultValue: "Certificat généré" }))
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function handleIssue(e: CertRow) {
    if (e.certificate_id) {
      const msg = t("fx.cert.confirm_reissue", {
        defaultValue: "Régénérer le certificat de {{name}} ? L'ancien fichier sera remplacé.",
        name: e.user_name ?? "",
      })
      if (!window.confirm(msg)) return
    }
    issueOne.mutate(e)
  }

  async function download(e: CertRow) {
    if (!e.certificate_id) return
    setDownloading(e.id)
    try {
      const res = await adminApi.downloadCertificate(e.certificate_id)
      saveBlob(res.data, `certificat-${e.certificate_id}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDownloading(null)
    }
  }

  async function issueAllReady() {
    if (bulk) return
    try {
      const { data } = await certificatesAdminApi.readyIds(filters)
      const ids = data.data
      if (ids.length === 0) {
        toast.info(t("fx.cert.none_ready", { defaultValue: "Aucun certificat prêt à émettre." }))
        return
      }
      if (!window.confirm(t("fx.cert.confirm_all", { defaultValue: "Émettre {{n}} certificats ?", n: ids.length }))) return

      let issued = 0
      let failed = 0
      const problems: string[] = []
      setBulk({ done: 0, total: ids.length })
      try {
        for (let i = 0; i < ids.length; i += CHUNK) {
          const res = (await certificatesAdminApi.issueBatch(ids.slice(i, i + CHUNK))).data.data
          issued += res.issued
          failed += res.failed
          for (const r of res.results) {
            if (r.status === "failed" && problems.length < 3) problems.push(`#${r.id} : ${r.message ?? ""}`)
          }
          setBulk({ done: Math.min(i + CHUNK, ids.length), total: ids.length })
        }
      } finally {
        setBulk(null)
        refresh()
      }
      toast.success(t("fx.cert.done", { defaultValue: "{{n}} certificat(s) émis.", n: issued }))
      if (failed > 0) toast.error(`${t("fx.cert.failed", { defaultValue: "{{n}} échec(s)", n: failed })} ${problems.join(" | ")}`)
      if (data.total > ids.length) {
        toast.info(t("fx.cert.more", { defaultValue: "Il reste des certificats prêts : relancez l'émission." }))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const tabs: { id: CertStatus; label: string; hint: string }[] = [
    { id: "ready", label: t("fx.cert.tab_ready", { defaultValue: "Prêts à émettre" }), hint: t("fx.cert.hint_ready", { defaultValue: "Cours terminé et examen validé (ou cours sans examen), certificat pas encore émis." }) },
    { id: "blocked", label: t("fx.cert.tab_blocked", { defaultValue: "Examen non réussi" }), hint: t("fx.cert.hint_blocked", { defaultValue: "Cours terminé mais examen final pas encore réussi : le certificat est impossible tant que l'examen n'est pas validé." }) },
    { id: "issued", label: t("fx.cert.tab_issued", { defaultValue: "Délivrés" }), hint: t("fx.cert.hint_issued", { defaultValue: "Certificats déjà émis : téléchargement ou réémission." }) },
    { id: "in_progress", label: t("fx.cert.tab_progress", { defaultValue: "En cours" }), hint: t("fx.cert.hint_progress", { defaultValue: "Cours pas encore terminé." }) },
  ]
  const active = tabs.find((x) => x.id === tab)
  const rows = list.data?.data ?? []
  const meta = list.data?.meta
  const busy = bulk !== null || actions.busy !== null

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map((x) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={tab === x.id}
            onClick={() => { setTab(x.id); setPage(1) }}
            className={`rounded-card border p-3 text-left transition ${
              tab === x.id ? "border-primary bg-primary/5" : "border-line bg-surface hover:border-primary/50"
            }`}
          >
            <span className="block text-2xl font-extrabold">{list.data?.counts[x.id] ?? 0}</span>
            <span className="block text-xs font-medium text-muted">{x.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {active && <p className="text-sm text-muted">{active.hint}</p>}
        {tab === "ready" && (
          <button type="button" onClick={() => void issueAllReady()} disabled={busy || (list.data?.counts.ready ?? 0) === 0} className={btnPrimary}>
            {bulk
              ? t("fx.cert.issuing", { defaultValue: "Émission {{done}}/{{total}}...", done: bulk.done, total: bulk.total })
              : t("fx.cert.issue_all", { defaultValue: "Émettre tous les certificats prêts" })}
          </button>
        )}
      </div>

      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.isLoading && <Skeleton className="h-48" />}

      {list.data && rows.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
          {t("fx.cert.empty", { defaultValue: "Aucun élève dans cet onglet." })}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4 shadow-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={e.user_name ?? "?"} />
                <span className="min-w-0">
                  <span className="block font-semibold">{e.user_name ?? "-"}</span>
                  <span className="block truncate text-xs text-muted">{e.user_email} · {e.course_title ?? "-"}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {e.status === "ready" && <Pill tone={tone.ready}>{t("fx.cert.tab_ready", { defaultValue: "Prêts à émettre" })}</Pill>}
                    {e.status === "blocked" && <Pill tone={tone.blocked}>{t("fx.cert.tab_blocked", { defaultValue: "Examen non réussi" })}</Pill>}
                    {e.status === "issued" && <Pill tone={tone.issued}>{t("admin.certificate", { defaultValue: "Certificat" })} {fmtDate(e.certificate_issued_at, locale)}</Pill>}
                    {e.status === "in_progress" && <Pill tone={tone.in_progress}>{e.progress} %</Pill>}
                    {e.completed && e.completed_at && <span className="text-xs text-muted">{t("fx.cert.completed_on", { defaultValue: "Terminé le" })} {fmtDate(e.completed_at, locale)}</span>}
                  </span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {e.certificate_id && (
                  <button type="button" disabled={downloading === e.id} onClick={() => void download(e)} className={btnGhost}>
                    {t("fx.cert.download", { defaultValue: "Télécharger" })}
                  </button>
                )}
                {(e.status === "ready" || e.status === "issued") && (
                  <button type="button" disabled={busy} onClick={() => void actions.send([e.id], e.user_email)} className={btnGhost}>
                    {t("fx.cert.email", { defaultValue: "E-mail" })}
                  </button>
                )}
                {(e.status === "ready" || e.status === "issued") && (
                  <button type="button" disabled={issueOne.isPending || busy} onClick={() => handleIssue(e)} className={e.status === "ready" ? btnPrimary : btnGhost}>
                    {e.status === "ready" ? t("admin.issue", { defaultValue: "Émettre" }) : t("admin.reissue", { defaultValue: "Réémettre" })}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {meta && <Pagination meta={meta} onChange={setPage} />}
    </div>
  )
}

export default function AdminCertificatesPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [view, setView] = useState<"student" | "status">("student")
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
    { id: "student", label: t("fx.cert.view_students", { defaultValue: "Par élève" }) },
    { id: "status", label: t("fx.cert.view_status", { defaultValue: "Par statut" }) },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("fx.cert.title", { defaultValue: "Certificats" })}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("fx.cert.intro", { defaultValue: "Émettez les certificats de tous les cours, un par un ou en lot. Les nouveaux cours apparaissent ici automatiquement." })}
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