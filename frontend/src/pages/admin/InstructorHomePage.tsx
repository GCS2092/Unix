import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminCourse } from "../../api/admin"
import { sessionsApi } from "../../api/sessions"
import { useLiveStatus } from "../../lib/useLiveStatus"
import { useAuthStore } from "../../stores/authStore"
import { adminPaths } from "../../lib/adminPaths"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import { buttonClass } from "../../components/buttonStyles"
import { Badge, PageHeader, panel } from "../../components/admin/PageHeader"

function Tile({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
    </div>
  )
}

export default function InstructorHomePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const user = useAuthStore((s) => s.user)
  const live = useLiveStatus()

  const courses = useQuery({
    queryKey: ["instructor-home-courses"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as AdminCourse[]
    },
    staleTime: 0,
  })
  const sessions = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => (await sessionsApi.adminList()).data.data,
    staleTime: 0,
  })

  const rows = courses.data ?? []
  const upcoming = sessions.data ?? []
  const next = upcoming[0]
  const liveNow = rows.filter((c) => live.isLive(c.id) === true)
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("px.ins.hello", { name: user?.name ?? "", defaultValue: "Bonjour {{name}}" })}
        subtitle={t("px.ins.subtitle", { defaultValue: "Vos cours, vos prochaines séances et vos directs." })}
        action={<Link to={adminPaths.formation.live} className={buttonClass()}>{t("px.ins.go_live", { defaultValue: "Aller au direct" })}</Link>}
      />

      {(courses.error || sessions.error) && (
        <ErrorState error={courses.error ?? sessions.error} onRetry={() => { void courses.refetch(); void sessions.refetch() }} />
      )}
      {courses.isLoading && <ListSkeleton rows={2} />}

      {courses.data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("px.ins.k_courses", { defaultValue: "Mes cours" })} value={rows.length} />
            <Tile label={t("px.ins.k_published", { defaultValue: "Publiés" })} value={rows.filter((c) => c.is_published).length} />
            <Tile label={t("px.ins.k_sessions", { defaultValue: "Séances à venir" })} value={upcoming.length} />
            <Tile label={t("px.ins.k_live", { defaultValue: "En direct" })} value={liveNow.length} tone={liveNow.length > 0 ? "text-danger" : ""} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={panel}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t("px.ins.next", { defaultValue: "Prochaine séance" })}</h2>
                <Link to={adminPaths.formation.sessions} className="text-sm font-semibold text-primary hover:underline">
                  {t("px.ins.plan", { defaultValue: "Planifier" })}
                </Link>
              </div>
              {next ? (
                <div>
                  <p className="font-semibold">{next.title || next.course_title}</p>
                  {next.title && <p className="text-sm text-muted">{next.course_title}</p>}
                  <p className="mt-2 inline-block rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">{fmt(next.starts_at)}</p>
                  {next.note && <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">{next.note}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted">{t("px.ins.no_session", { defaultValue: "Aucune séance planifiée." })}</p>
              )}
            </section>

            <section className={panel}>
              <h2 className="mb-3 text-base font-semibold">{t("px.ins.live_state", { defaultValue: "État des directs" })}</h2>
              {rows.length === 0 ? (
                <p className="text-sm text-muted">{t("px.ins.no_course", { defaultValue: "Aucun cours ne vous est attribué pour le moment. Contactez l'administration." })}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {rows.map((c) => {
                    const on = live.isLive(c.id) === true
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate font-medium">{c.title}</span>
                        <Badge tone={on ? "danger" : "muted"}>{on ? t("px.ins.live_on", { defaultValue: "En direct" }) : t("px.ins.live_off", { defaultValue: "Hors ligne" })}</Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className={panel}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{t("px.ins.my_courses", { defaultValue: "Mes cours" })}</h2>
              <Link to={adminPaths.formation.courses} className="text-sm font-semibold text-primary hover:underline">
                {t("px.ins.manage", { defaultValue: "Gérer" })}
              </Link>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">{t("px.ins.no_course", { defaultValue: "Aucun cours ne vous est attribué pour le moment. Contactez l'administration." })}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {rows.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-medium">{c.title}</p>
                      <Badge tone={c.is_published ? "success" : "muted"}>{c.is_published ? t("admin.published") : t("admin.draft")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
