import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { certificatesAdminApi, type CertRow, type StudentCerts } from "../../api/certificatesAdmin"
import { useCertificateActions } from "../../hooks/useCertificateActions"
import { ErrorState } from "../States"
import { Skeleton } from "../Skeleton"
import Pagination from "../Pagination"
import { Pill } from "./ui"
import { Avatar } from "./formationUi"
import CertificateCorrectModal from "./CertificateCorrectModal"

const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[36px] rounded-lg border border-line bg-surface px-3 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"

const tone = { ready: "info", blocked: "warn", issued: "success", in_progress: "neutral" } as const

function fmtDate(d: string | null | undefined, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-"
}

function Medal({ on }: { on: boolean }) {
  return (
    <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${on ? "bg-primary/10 text-primary" : "bg-black/5 text-muted"}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8" />
      </svg>
    </span>
  )
}

function StudentCard({ s, locale }: { s: StudentCerts; locale: string }) {
  const { t } = useTranslation()
  const actions = useCertificateActions()
  const [sel, setSel] = useState<number[]>([])
  const [fixing, setFixing] = useState<number | null>(null)

  const eligible = s.enrollments.filter((e) => e.status === "ready" || e.status === "issued")
  const picked = sel.filter((id) => eligible.some((e) => e.id === id))
  const issued = s.enrollments.filter((e) => e.status === "issued").length
  const busy = actions.busy !== null
  const toggle = (id: number) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const label = (e: CertRow) => {
    if (e.status === "ready") return t("fx.cert.tab_ready", { defaultValue: "Prêts à émettre" })
    if (e.status === "blocked") return t("fx.cert.tab_blocked", { defaultValue: "Examen non réussi" })
    if (e.status === "issued") return t("fx.cert.tab_issued", { defaultValue: "Délivrés" })
    return `${e.progress} %`
  }
  const note = (e: CertRow) => {
    if (e.status === "ready") return t("fx.cert.st_ready", { defaultValue: "Cours terminé et examen validé" })
    if (e.status === "blocked") return t("fx.cert.st_blocked", { defaultValue: "Cours terminé, examen final à réussir" })
    if (e.status === "issued") return t("fx.cert.st_issued", { defaultValue: "Délivré le {{date}}", date: fmtDate(e.certificate_issued_at, locale) })
    return t("fx.cert.st_progress", { defaultValue: "Cours en cours : {{n}} %", n: e.progress })
  }

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={s.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{s.name}</p>
            <p className="truncate text-xs text-muted">{s.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!s.email_verified && <Pill tone="warn">{t("fx.cert.unverified", { defaultValue: "E-mail non vérifié" })}</Pill>}
          {s.blocked && <Pill tone="danger">{t("fx.cert.blocked_account", { defaultValue: "Compte bloqué" })}</Pill>}
          <span className="text-xs text-muted">
            {t("fx.cert.courses_count", { defaultValue: "{{n}} formation(s)", n: s.enrollments.length })} ·{" "}
            {t("fx.cert.issued_count", { defaultValue: "{{n}} certificat(s)", n: issued })}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {s.enrollments.map((e) => {
          const can = e.status === "ready" || e.status === "issued"
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-page/60 px-3 py-2.5">
              <input
                type="checkbox" className="h-5 w-5 flex-none" disabled={!can || busy}
                checked={picked.includes(e.id)} onChange={() => toggle(e.id)}
                aria-label={e.course_title ?? ""}
              />
              <Medal on={e.status === "issued"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.course_title ?? "-"}</p>
                <p className="text-xs text-muted">{note(e)}</p>
              </div>
              <Pill tone={tone[e.status]}>{label(e)}</Pill>
              {e.revoked && <Pill tone="danger">{t("fx.cert.revoked", { defaultValue: "Révoqué" })}</Pill>}
              <button type="button" disabled={busy} onClick={() => setFixing(e.id)} className={btnGhost}>
                {t("fx.cert.fix", { defaultValue: "Corriger" })}
              </button>
              {can && (
                <div className="flex gap-1.5">
                  <button type="button" disabled={busy} onClick={() => void actions.download([e.id], `${s.name}-${e.course_title ?? ""}`)} className={btnGhost}>
                    {t("fx.cert.pdf", { defaultValue: "PDF" })}
                  </button>
                  <button type="button" disabled={busy || s.blocked} onClick={() => void actions.send([e.id], s.email)} className={btnGhost}>
                    {t("fx.cert.email", { defaultValue: "E-mail" })}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {eligible.length > 1 && picked.length === 0 && (
        <button type="button" onClick={() => setSel(eligible.map((e) => e.id))} className="mt-3 text-sm font-semibold text-primary hover:underline">
          {t("fx.cert.select_all", { defaultValue: "Tout sélectionner" })}
        </button>
      )}

      {fixing !== null && <CertificateCorrectModal enrollmentId={fixing} onClose={() => setFixing(null)} />}

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-3 py-2.5">
          <span className="text-sm font-semibold">{t("fx.cert.selected", { defaultValue: "{{n}} sélectionné(s)", n: picked.length })}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void actions.download(picked, s.name)} className={btnGhost}>
              {actions.busy === "file" ? t("fx.cert.preparing", { defaultValue: "Préparation..." }) : t("fx.cert.download_sel", { defaultValue: "Télécharger" })}
            </button>
            <button type="button" disabled={busy || s.blocked} onClick={() => void actions.send(picked, s.email)} className={btnPrimary}>
              {actions.busy === "send" ? t("fx.cert.sending", { defaultValue: "Envoi..." }) : t("fx.cert.send_sel", { defaultValue: "Envoyer par e-mail" })}
            </button>
          </div>
          <p className="w-full text-xs text-muted">{t("fx.cert.send_note", { defaultValue: "L'e-mail part à l'adresse du compte : {{email}}", email: s.email })}</p>
        </div>
      )}
    </li>
  )
}

export default function CertificatesByStudent({ courseId, q, locale }: { courseId: string; q: string; locale: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const list = useQuery({
    queryKey: ["admin-certificates-students", courseId, q, page],
    queryFn: async () =>
      (await certificatesAdminApi.students({ course_id: courseId ? Number(courseId) : undefined, q: q || undefined, page })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {t("fx.cert.students_hint", { defaultValue: "Chaque élève avec ses formations : un certificat au plus par formation. Cochez ceux à télécharger ou à envoyer." })}
      </p>

      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.isLoading && <Skeleton className="h-48" />}

      {list.data && rows.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted shadow-card">
          {t("fx.cert.no_students", { defaultValue: "Aucun élève trouvé." })}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((s) => <StudentCard key={s.id} s={s} locale={locale} />)}
        </ul>
      )}

      {meta && <Pagination meta={meta} onChange={setPage} />}
    </div>
  )
}