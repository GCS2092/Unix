import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import { formationsApi, type Metric } from "../../api/formations"
import { enrollmentRequestsApi } from "../../api/enrollmentRequests"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import Button from "../../components/Button"
import { Drawer, Pill, StatCard } from "../../components/admin/ui"
import { Avatar, EmptyBlock, Hero, ICON, Panel, ProgressBar, Ring, Segmented, heroBtn, heroBtnGhost } from "../../components/admin/formationUi"
import { Svg } from "../../components/admin/ui"
import EnrollmentRequestsCard from "./EnrollmentRequestsCard"

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

interface Picked { id: number; name: string; email: string }

function useRefreshAll() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin-formations"] })
    void qc.invalidateQueries({ queryKey: ["admin-users"] })
    void qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
  }
}

function StudentPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const refresh = useRefreshAll()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [courseId, setCourseId] = useState("")
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as { id: number; title: string }[]
    },
  })

  const save = useMutation({
    mutationFn: () =>
      formationsApi.createStudent({
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        course_id: courseId ? Number(courseId) : undefined,
      }),
    onSuccess: ({ data }) => {
      if (data.created) toast.success(data.mail_sent ? t("px.fm.created_mail") : t("px.fm.created_no_mail"))
      else toast.success(t("px.fm.linked", { n: data.orders_count }))
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }} className="space-y-4">
      <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-muted">{t("px.fm.panel_student_hint")}</p>
      <label className="block text-sm font-medium">
        {t("px.fm.email")}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("px.fm.name")}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-muted">{t("px.fm.name_hint")}</span>
      </label>
      <label className="block text-sm font-medium">
        {t("px.fm.phone_optional")}
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("px.fm.course_optional")}
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
          <option value="">{t("px.fm.none")}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <Button type="submit" size="lg" loading={save.isPending}>{t("px.fm.submit_student")}</Button>
    </form>
  )
}

function EnrollPanel({ initial, initialCourse, onClose }: { initial: Picked | null; initialCourse: string; onClose: () => void }) {
  const { t } = useTranslation()
  const refresh = useRefreshAll()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Picked | null>(initial)
  const [courseId, setCourseId] = useState(initialCourse)

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350)
    return () => clearTimeout(id)
  }, [input])

  const users = useQuery({
    queryKey: ["admin-users-pick", q],
    queryFn: async () => (await enrollmentRequestsApi.searchUsers(q)).data.data,
    enabled: q.length >= 2 && !picked,
  })
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as { id: number; title: string }[]
    },
  })

  const save = useMutation({
    mutationFn: () => formationsApi.enroll({ user_id: picked!.id, course_id: Number(courseId) }),
    onSuccess: () => {
      toast.success(t("px.fm.enrolled"))
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (picked && courseId) save.mutate() }}
      className="space-y-4"
    >
      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={picked.name} />
            <div className="min-w-0">
              <p className="font-semibold">{picked.name}</p>
              <p className="truncate text-muted">{picked.email}</p>
            </div>
          </div>
          <button type="button" onClick={() => setPicked(null)} className="font-semibold text-primary hover:underline">{t("px.fm.change_person")}</button>
        </div>
      ) : (
        <div>
          <input
            type="search" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={t("px.fm.search")} className={inputClass}
          />
          {users.data && users.data.length > 0 && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm">
              {users.data.map((u) => (
                <li key={u.id}>
                  <button
                    type="button" onClick={() => setPicked({ id: u.id, name: u.name, email: u.email })}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-page"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                    </span>
                    {u.is_student && <Pill tone="info">{t("px.fm.student")}</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <label className="block text-sm font-medium">
        {t("px.fm.course")}
        <select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
          <option value="">{t("px.fm.choose")}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <Button type="submit" size="lg" loading={save.isPending} disabled={!picked || !courseId}>{t("px.fm.submit_enroll")}</Button>
    </form>
  )
}

export default function AdminFormationsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [panel, setPanel] = useState<"student" | "enroll" | null>(null)
  const [pick, setPick] = useState<Picked | null>(null)
  const [pickCourse, setPickCourse] = useState("")
  const [days, setDays] = useState(14)
  const [todo, setTodo] = useState<"stalled" | "enroll" | "empty">("stalled")

  const q = useQuery({
    queryKey: ["admin-formations", days],
    queryFn: async () => (await formationsApi.dashboard({ days })).data.data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const remind = useMutation({
    mutationFn: (id: number) => formationsApi.remind(id),
    onSuccess: () => toast.success(t("px.fm.reminded")),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-")
  const delta = (m: Metric) =>
    m.change === null
      ? t("px.fm.new_label")
      : m.change === 0
        ? t("px.fm.stable")
        : `${m.change > 0 ? "\u25b2" : "\u25bc"} ${Math.abs(m.change)} % ${t("px.fm.vs")}`

  function openEnroll(p: Picked | null, course = "") {
    setPickCourse(course)
    setPick(p)
    setPanel("enroll")
  }

  const d = q.data
  const s = d?.summary
  const empty = d?.empty_courses ?? []

  return (
    <div className="space-y-6">
      <Hero
        title={t("px.fm.title")}
        subtitle={s ? t("px.fm.k_students_hint", { n: s.active_students_30d }) : undefined}
        actions={
          <>
            <button type="button" data-tour="fm-add" onClick={() => setPanel("student")} className={heroBtn}>
              <Svg d={ICON.plus} className="h-4 w-4" />{t("px.fm.add_student")}
            </button>
            <button type="button" data-tour="fm-enroll" onClick={() => openEnroll(null)} className={heroBtnGhost}>
              <Svg d={ICON.enroll} className="h-4 w-4" />{t("px.fm.enroll")}
            </button>
          </>
        }
      />

      <Drawer open={panel === "student"} title={t("px.fm.add_student")} onClose={() => setPanel(null)}>
        <StudentPanel onClose={() => setPanel(null)} />
      </Drawer>
      <Drawer open={panel === "enroll"} title={t("px.fm.enroll")} onClose={() => setPanel(null)}>
        <EnrollPanel key={`${pick?.id ?? "none"}-${pickCourse}`} initial={pick} initialCourse={pickCourse} onClose={() => setPanel(null)} />
      </Drawer>

      <EnrollmentRequestsCard />
      {q.error && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}

      {q.isLoading && (
        <div role="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {d && s && (
        <>
          <div data-tour="fm-kpi" className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("px.fm.k_students")} value={s.students_total} icon={ICON.users} tone="info" hint={t("px.fm.k_students_hint", { n: s.active_students_30d })} />
            <StatCard label={t("px.fm.k_enrollments")} value={s.enrollments_total} icon={ICON.enroll} hint={delta(d.period.enrollments)} />
            <StatCard label={t("px.fm.k_completion")} value={`${s.completion_rate} %`} icon={ICON.check} tone="success" hint={`${s.completed} / ${s.enrollments_total}`} />
            <StatCard label={t("px.fm.k_avg")} value={`${s.avg_progress} %`} icon={ICON.chart} tone="info" />
            <StatCard label={t("px.fm.k_completed")} value={s.completed} icon={ICON.check} tone="success" hint={delta(d.period.completed)} />
            <StatCard label={t("px.fm.k_certs")} value={s.certificates_total} icon={ICON.award} tone="warn" hint={delta(d.period.certificates)} />
            <StatCard label={t("px.fm.k_courses")} value={`${s.courses_published} / ${s.courses_total}`} icon={ICON.book} hint={t("px.fm.k_courses_hint", { n: s.courses_live })} />
            <StatCard
              label={t("px.fm.k_no_course")} value={s.students_without_course} icon={ICON.alert}
              tone={s.students_without_course > 0 ? "warn" : "neutral"}
              onClick={s.students_without_course > 0 ? () => setTodo("enroll") : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2" icon={ICON.alert} title={t("px.fm.todo")}
              action={
                <Segmented
                  value={todo} onChange={setTodo}
                  items={[
                    { id: "stalled", label: t("px.fm.stalled"), badge: d.stalled_count },
                    { id: "enroll", label: t("px.fm.tab_enroll"), badge: d.to_enroll.length },
                    { id: "empty", label: t("px.fm.empty_courses", { defaultValue: "Cours sans inscrit" }), badge: empty.length },
                  ]}
                />
              }
            >
              {todo === "stalled" && (
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{t("px.fm.stalled_since", { defaultValue: "Inactifs depuis" })}</span>
                    <div role="group" className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
                      {[7, 14, 30, 60].map((n) => (
                        <button
                          key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}
                          className={`rounded-md px-2.5 py-1 font-medium transition ${days === n ? "bg-primary text-white" : "hover:bg-black/5 hover:text-ink"}`}
                        >
                          {n} {t("px.fm.days_short", { defaultValue: "j" })}
                        </button>
                      ))}
                    </div>
                    <span className="ml-auto">{t("px.fm.stalled_total", { n: d.stalled_count })}</span>
                  </div>
                  {d.stalled.length === 0 ? (
                    <EmptyBlock icon={ICON.check} text={t("px.fm.nothing")} />
                  ) : (
                    <ul className="divide-y divide-line text-sm">
                      {d.stalled.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 py-3">
                          <Avatar name={e.user_name ?? "?"} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate font-semibold">{e.user_name ?? "-"}</span>
                              <span className="shrink-0 text-xs font-semibold text-muted">{e.progress} %</span>
                            </div>
                            <p className="truncate text-xs text-muted">{e.course_title} &middot; {t("px.fm.last_activity")} : {fmt(e.last_activity)}</p>
                            <div className="mt-1.5"><ProgressBar value={e.progress} /></div>
                            <button
                              type="button" onClick={() => remind.mutate(e.id)} disabled={remind.isPending}
                              className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
                            >
                              <Svg d={ICON.mail} className="h-3.5 w-3.5" />{t("px.fm.remind")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {todo === "enroll" && (
                d.to_enroll.length === 0 ? (
                  <EmptyBlock icon={ICON.check} text={t("px.fm.nothing")} />
                ) : (
                  <ul className="divide-y divide-line text-sm">
                    {d.to_enroll.map((u) => (
                      <li key={u.id} className="flex items-center gap-3 py-3">
                        <Avatar name={u.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{u.name}</span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                        <button
                          type="button" onClick={() => openEnroll(u)}
                          className="min-h-[40px] shrink-0 rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                        >
                          {t("px.fm.enroll_btn")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {todo === "empty" && (
                empty.length === 0 ? (
                  <EmptyBlock icon={ICON.check} text={t("px.fm.nothing")} />
                ) : (
                  <ul className="divide-y divide-line text-sm">
                    {empty.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-3">
                        <Avatar name={c.title} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                        <button
                          type="button" onClick={() => openEnroll(null, String(c.id))}
                          className="min-h-[40px] shrink-0 rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                        >
                          {t("px.fm.enroll_btn")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </Panel>

            <Panel icon={ICON.chart} title={t("px.fm.k_completion")}>
              <div className="flex flex-col items-center gap-4">
                <Ring value={s.completion_rate} />
                <dl className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between"><dt className="text-muted">{t("px.fm.k_completed")}</dt><dd><Pill tone="success" dot>{s.completed}</Pill></dd></div>
                  <div className="flex items-center justify-between"><dt className="text-muted">{t("admin.in_progress", { defaultValue: "En cours" })}</dt><dd><Pill tone="info" dot>{s.in_progress}</Pill></dd></div>
                  <div className="flex items-center justify-between"><dt className="text-muted">{t("px.fm.k_certs")}</dt><dd><Pill tone="warn" dot>{s.certificates_total}</Pill></dd></div>
                </dl>
                <div className="w-full">
                  <div className="mb-1 flex justify-between text-xs text-muted"><span>{t("px.fm.k_avg")}</span><span>{s.avg_progress} %</span></div>
                  <ProgressBar value={s.avg_progress} />
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              icon={ICON.book} title={t("px.fm.top_courses")}
              action={<Link to="/admin/formation/cours" className="text-sm font-semibold text-primary hover:underline">{t("px.fm.manage_courses")}</Link>}
            >
              {d.top_courses.length === 0 ? (
                <EmptyBlock icon={ICON.book} text={t("px.fm.no_courses")} />
              ) : (
                <ul className="space-y-4 text-sm">
                  {d.top_courses.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-page text-xs font-bold text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold">
                            {c.title}
                            {!c.is_published && <span className="ml-2"><Pill>{t("px.fm.draft")}</Pill></span>}
                          </span>
                          <span className="shrink-0 text-xs text-muted">{c.enrollments} &middot; {t("px.fm.completed_of", { done: c.completed, total: c.enrollments })}</span>
                        </div>
                        <div className="mt-1.5"><ProgressBar value={c.avg_progress} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              icon={ICON.clock} title={t("px.fm.recent")}
              action={<Link to="/admin/formation/inscriptions" className="text-sm font-semibold text-primary hover:underline">{t("px.fm.see_all")}</Link>}
            >
              {d.recent.length === 0 ? (
                <EmptyBlock icon={ICON.enroll} text={t("px.fm.no_enrollments")} />
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {d.recent.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-3">
                      <Avatar name={e.user_name ?? "?"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.user_name ?? "-"}</span>
                        <span className="block truncate text-xs text-muted">{e.course_title} &middot; {fmt(e.created_at)}</span>
                      </span>
                      <Pill tone={e.completed ? "success" : "info"} dot>{e.progress} %</Pill>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/admin/systeme/utilisateurs" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">{t("px.fm.manage_users")}</Link>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}