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
import { Pill, StatCard, Svg } from "../../components/admin/ui"
import { Avatar, EmptyBlock, Hero, Panel, heroBtn } from "../../components/admin/formationUi"
import { ICON } from "../../components/admin/formationIcons"

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
  const noCourse = t("px.ins.no_course", { defaultValue: "Aucun cours ne vous est attribué pour le moment. Contactez l'administration." })

  return (
    <div className="space-y-6">
      <Hero
        title={t("px.ins.hello", { name: user?.name ?? "", defaultValue: "Bonjour {{name}}" })}
        subtitle={t("px.ins.subtitle", { defaultValue: "Vos cours, vos prochaines séances et vos directs." })}
        actions={
          <Link to={adminPaths.formation.live} className={heroBtn}>
            <Svg d={ICON.video} className="h-4 w-4" />{t("px.ins.go_live", { defaultValue: "Aller au direct" })}
          </Link>
        }
      />

      {(courses.error || sessions.error) && (
        <ErrorState error={courses.error ?? sessions.error} onRetry={() => { void courses.refetch(); void sessions.refetch() }} />
      )}
      {courses.isLoading && <ListSkeleton rows={2} />}

      {courses.data && (
        <>
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("px.ins.k_courses", { defaultValue: "Mes cours" })} value={rows.length} icon={ICON.book} tone="info" />
            <StatCard label={t("px.ins.k_published", { defaultValue: "Publiés" })} value={rows.filter((c) => c.is_published).length} icon={ICON.check} tone="success" />
            <StatCard label={t("px.ins.k_sessions", { defaultValue: "Séances à venir" })} value={upcoming.length} icon={ICON.calendar} tone="warn" />
            <StatCard label={t("px.ins.k_live", { defaultValue: "En direct" })} value={liveNow.length} icon={ICON.video} tone={liveNow.length > 0 ? "danger" : "neutral"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              icon={ICON.calendar} title={t("px.ins.next", { defaultValue: "Prochaine séance" })}
              action={<Link to={adminPaths.formation.sessions} className="text-sm font-semibold text-primary hover:underline">{t("px.ins.plan", { defaultValue: "Planifier" })}</Link>}
            >
              {next ? (
                <div className="rounded-xl bg-primary/5 p-4">
                  <p className="font-bold">{next.title || next.course_title}</p>
                  {next.title && <p className="text-sm text-muted">{next.course_title}</p>}
                  <p className="mt-3 inline-block rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-white shadow-sm">{fmt(next.starts_at)}</p>
                  {next.note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">{next.note}</p>}
                </div>
              ) : (
                <EmptyBlock icon={ICON.calendar} text={t("px.ins.no_session", { defaultValue: "Aucune séance planifiée." })} />
              )}
            </Panel>

            <Panel icon={ICON.video} title={t("px.ins.live_state", { defaultValue: "État des directs" })}>
              {rows.length === 0 ? (
                <EmptyBlock icon={ICON.book} text={noCourse} />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {rows.map((c) => {
                    const on = live.isLive(c.id) === true
                    return (
                      <li key={c.id} className="flex items-center gap-3 py-2.5">
                        <Avatar name={c.title} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                        <Pill tone={on ? "danger" : "neutral"} dot>{on ? t("px.ins.live_on", { defaultValue: "En direct" }) : t("px.ins.live_off", { defaultValue: "Hors ligne" })}</Pill>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            icon={ICON.book} title={t("px.ins.my_courses", { defaultValue: "Mes cours" })}
            action={<Link to={adminPaths.formation.courses} className="text-sm font-semibold text-primary hover:underline">{t("px.ins.manage", { defaultValue: "Gérer" })}</Link>}
          >
            {rows.length === 0 ? (
              <EmptyBlock icon={ICON.book} text={noCourse} />
            ) : (
              <ul className="stagger grid gap-3 sm:grid-cols-2">
                {rows.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-primary/40 hover:shadow-card">
                    <Avatar name={c.title} />
                    <p className="min-w-0 flex-1 truncate font-semibold">{c.title}</p>
                    <Pill tone={c.is_published ? "success" : "neutral"} dot>{c.is_published ? t("admin.published") : t("admin.draft")}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
