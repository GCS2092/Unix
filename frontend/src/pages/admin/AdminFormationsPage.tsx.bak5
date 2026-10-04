import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import { formationsApi, type Metric } from "../../api/formations"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import Button from "../../components/Button"

const T = {
  title: "Formations",
  addStudent: "Ajouter / relier un \u00e9tudiant",
  enroll: "Inscrire \u00e0 un cours",
  close: "Fermer",
  newLabel: "Nouveau",
  stable: "Stable",
  vs: "vs 30 jours pr\u00e9c\u00e9dents",
  kStudents: "\u00c9tudiants",
  kStudentsHint: (n: number) => `${n} actif(s) sur 30 jours`,
  kEnrollments: "Inscriptions",
  kCompletion: "Taux d'ach\u00e8vement",
  kAvg: "Progression moyenne",
  kCompleted: "Formations termin\u00e9es",
  kCerts: "Certificats d\u00e9livr\u00e9s",
  kCourses: "Cours publi\u00e9s",
  kCoursesHint: (live: number) => `${live} avec session en direct`,
  kNoCourse: "\u00c9tudiants sans cours",
  todo: "\u00c0 traiter",
  nothing: "Rien \u00e0 traiter pour le moment.",
  stalled: "Sans activit\u00e9 depuis 14 jours",
  stalledMore: (n: number) => `${n} au total`,
  lastActivity: "Derni\u00e8re activit\u00e9",
  toEnroll: "\u00c9tudiants \u00e0 inscrire \u00e0 un cours",
  enrollBtn: "Inscrire",
  topCourses: "Cours les plus suivis",
  noCourses: "Aucun cours pour le moment.",
  completedOf: (a: number, b: number) => `${a}/${b} termin\u00e9(s)`,
  draft: "Brouillon",
  recent: "Derni\u00e8res inscriptions",
  noEnrollments: "Aucune inscription pour le moment.",
  seeAll: "Tout voir",
  manageCourses: "G\u00e9rer les cours",
  manageUsers: "G\u00e9rer les comptes",
  email: "E-mail",
  name: "Nom complet",
  nameHint: "Utile seulement si le compte n'existe pas encore.",
  phone: "T\u00e9l\u00e9phone (facultatif)",
  course: "Cours",
  courseOptional: "Inscrire aussi \u00e0 un cours (facultatif)",
  none: "Aucun",
  choose: "Choisir un cours",
  submitStudent: "Valider",
  submitEnroll: "Inscrire",
  panelStudentHint: "Si l'e-mail correspond \u00e0 un compte existant (client de la boutique), il est simplement reli\u00e9 : m\u00eame compte, acc\u00e8s aux formations activ\u00e9. Sinon un compte est cr\u00e9\u00e9 et un e-mail est envoy\u00e9 pour choisir son mot de passe.",
  search: "Rechercher un nom ou un e-mail (2 lettres min.)",
  student: "\u00c9tudiant",
  changePerson: "Changer",
  createdMail: "Compte cr\u00e9\u00e9. Un e-mail a \u00e9t\u00e9 envoy\u00e9 pour choisir son mot de passe.",
  createdNoMail: "Compte cr\u00e9\u00e9, mais l'e-mail n'a pas pu partir. Utilisez \u00ab mot de passe oubli\u00e9 \u00bb pour lui envoyer le lien.",
  linked: (n: number) => `Compte existant reli\u00e9 : acc\u00e8s aux formations activ\u00e9 (${n} commande(s) en boutique).`,
  enrolled: "Inscription enregistr\u00e9e.",
  loadError: "Impossible de charger les formations.",
}

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"

interface Picked { id: number; name: string; email: string }

function Delta({ m }: { m: Metric }) {
  if (m.change === null) return <span className="text-xs text-muted">{T.newLabel}</span>
  if (m.change === 0) return <span className="text-xs text-muted">{T.stable}</span>
  const up = m.change > 0
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-danger"}`}>
      {up ? "\u25b2" : "\u25bc"} {Math.abs(m.change)} %
    </span>
  )
}

function Kpi({ label, value, tone = "", foot }: { label: string; value: string | number; tone?: string; foot?: ReactNode }) {
  return (
    <div className="h-full rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
      <div className="mt-1 min-h-4 text-xs text-muted">{foot}</div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

function useRefreshAll() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin-formations"] })
    void qc.invalidateQueries({ queryKey: ["admin-users"] })
    void qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
  }
}

function StudentPanel({ onClose }: { onClose: () => void }) {
  const refresh = useRefreshAll()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [courseId, setCourseId] = useState("")
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => (await adminApi.courses(1)).data.data,
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
      if (data.created) toast.success(data.mail_sent ? T.createdMail : T.createdNoMail)
      else toast.success(T.linked(data.orders_count))
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }} className={`${card} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{T.addStudent}</h3>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">{T.close}</button>
      </div>
      <p className="text-sm text-muted">{T.panelStudentHint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {T.email}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {T.name}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-muted">{T.nameHint}</span>
        </label>
        <label className="block text-sm font-medium">
          {T.phone}
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {T.courseOptional}
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
            <option value="">{T.none}</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      <Button type="submit" size="lg" loading={save.isPending}>{T.submitStudent}</Button>
    </form>
  )
}

function EnrollPanel({ initial, onClose }: { initial: Picked | null; onClose: () => void }) {
  const refresh = useRefreshAll()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Picked | null>(initial)
  const [courseId, setCourseId] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350)
    return () => clearTimeout(id)
  }, [input])

  const users = useQuery({
    queryKey: ["admin-users-pick", q],
    queryFn: async () => (await adminApi.users(1, q)).data.data,
    enabled: q.length >= 2 && !picked,
  })
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => (await adminApi.courses(1)).data.data,
  })

  const save = useMutation({
    mutationFn: () => formationsApi.enroll({ user_id: picked!.id, course_id: Number(courseId) }),
    onSuccess: () => {
      toast.success(T.enrolled)
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (picked && courseId) save.mutate() }}
      className={`${card} space-y-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{T.enroll}</h3>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">{T.close}</button>
      </div>

      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">{picked.name}</p>
            <p className="truncate text-muted">{picked.email}</p>
          </div>
          <button type="button" onClick={() => setPicked(null)} className="font-semibold text-primary hover:underline">{T.changePerson}</button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={T.search}
            className={inputClass}
          />
          {users.data && users.data.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
              {users.data.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setPicked({ id: u.id, name: u.name, email: u.email })}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-page"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                    {u.is_student && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{T.student}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block text-sm font-medium">
        {T.course}
        <select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
          <option value="">{T.choose}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <Button type="submit" size="lg" loading={save.isPending} disabled={!picked || !courseId}>{T.submitEnroll}</Button>
    </form>
  )
}

export default function AdminFormationsPage() {
  const [panel, setPanel] = useState<"student" | "enroll" | null>(null)
  const [pick, setPick] = useState<Picked | null>(null)

  const q = useQuery({
    queryKey: ["admin-formations"],
    queryFn: async () => (await formationsApi.dashboard()).data.data,
    staleTime: 30_000,
  })

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "-")

  function openEnroll(p: Picked | null) {
    setPick(p)
    setPanel("enroll")
  }

  const d = q.data
  const s = d?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{T.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPanel(panel === "student" ? null : "student")}>{T.addStudent}</Button>
          <Button variant="secondary" onClick={() => openEnroll(null)}>{T.enroll}</Button>
        </div>
      </div>

      {panel === "student" && <StudentPanel onClose={() => setPanel(null)} />}
      {panel === "enroll" && <EnrollPanel key={pick?.id ?? "none"} initial={pick} onClose={() => setPanel(null)} />}

      {q.error && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}

      {q.isLoading && (
        <div role="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      )}

      {d && s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={T.kStudents} value={s.students_total} foot={T.kStudentsHint(s.active_students_30d)} />
            <Kpi label={T.kEnrollments} value={s.enrollments_total} foot={<><Delta m={d.period.enrollments} /> <span>{T.vs}</span></>} />
            <Kpi label={T.kCompletion} value={`${s.completion_rate} %`} tone="text-primary" foot={`${s.completed} / ${s.enrollments_total}`} />
            <Kpi label={T.kAvg} value={`${s.avg_progress} %`} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={T.kCompleted} value={s.completed} foot={<><Delta m={d.period.completed} /> <span>{T.vs}</span></>} />
            <Kpi label={T.kCerts} value={s.certificates_total} foot={<><Delta m={d.period.certificates} /> <span>{T.vs}</span></>} />
            <Kpi label={T.kCourses} value={`${s.courses_published} / ${s.courses_total}`} foot={T.kCoursesHint(s.courses_live)} />
            <Kpi label={T.kNoCourse} value={s.students_without_course} tone={s.students_without_course > 0 ? "text-accent" : ""} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={T.todo}>
              {d.stalled.length === 0 && d.to_enroll.length === 0 ? (
                <p className="text-sm text-muted">{T.nothing}</p>
              ) : (
                <div className="space-y-5">
                  {d.to_enroll.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">{T.toEnroll}</p>
                      <ul className="divide-y divide-line text-sm">
                        {d.to_enroll.map((u) => (
                          <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0">
                              <span className="block font-medium">{u.name}</span>
                              <span className="block truncate text-xs text-muted">{u.email}</span>
                            </span>
                            <button type="button" onClick={() => openEnroll(u)} className="min-h-[44px] shrink-0 px-2 font-semibold text-primary hover:underline">
                              {T.enrollBtn}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.stalled.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">
                        {T.stalled} <span className="font-normal text-muted">({T.stalledMore(d.stalled_count)})</span>
                      </p>
                      <ul className="divide-y divide-line text-sm">
                        {d.stalled.map((e) => (
                          <li key={e.id} className="py-2">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate font-medium">{e.user_name ?? "-"}</span>
                              <span className="shrink-0 text-xs text-muted">{e.progress} %</span>
                            </div>
                            <p className="truncate text-xs text-muted">{e.course_title} &middot; {T.lastActivity} : {fmt(e.last_activity)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card title={T.topCourses} action={<Link to="/admin/cours" className="text-sm font-semibold text-primary hover:underline">{T.manageCourses}</Link>}>
              {d.top_courses.length === 0 ? (
                <p className="text-sm text-muted">{T.noCourses}</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {d.top_courses.map((c) => (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {c.title}
                          {!c.is_published && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-xs text-muted">{T.draft}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{c.enrollments} &middot; {T.completedOf(c.completed, c.enrollments)}</span>
                      </div>
                      <div className="mt-1"><Bar value={c.avg_progress} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={T.recent} action={<Link to="/admin/inscriptions" className="text-sm font-semibold text-primary hover:underline">{T.seeAll}</Link>}>
            {d.recent.length === 0 ? (
              <p className="text-sm text-muted">{T.noEnrollments}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {d.recent.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium">{e.user_name ?? "-"}</span>
                      <span className="block truncate text-xs text-muted">{e.course_title} &middot; {fmt(e.created_at)}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                      {e.progress} %
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/utilisateurs" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">{T.manageUsers}</Link>
          </Card>
        </>
      )}
    </div>
  )
}