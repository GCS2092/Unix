Set-Location C:\Unix
$utf8 = New-Object Text.UTF8Encoding($false)
function W($p, $c) { $full = Join-Path "C:\Unix" $p; New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null; [IO.File]::WriteAllText($full, $c, $utf8) }
function Rep($rel, $old, $new) { $p = Join-Path "C:\Unix" $rel; $c = [IO.File]::ReadAllText($p); if (-not $c.Contains($old)) { Write-Warning "$rel : introuvable -> $old"; return }; $i = $c.IndexOf($old); [IO.File]::WriteAllText($p, $c.Substring(0, $i) + $new + $c.Substring($i + $old.Length), $utf8) }

if (Test-Path "frontend\src\pages\CoursesPage.tsx") { Write-Warning "Etape 5 deja appliquee."; return }

# ------------------------------------------------------------------
# 1. API : la route playback resout le cours par SLUG (getRouteKeyName), pas par id
# ------------------------------------------------------------------
Rep "frontend\src\api\enrollments.ts" 'playback: (courseId: number) =>' 'playback: (courseSlug: string) =>'
Rep "frontend\src\api\enrollments.ts" '/courses/${courseId}/playback' '/courses/${courseSlug}/playback'

# ------------------------------------------------------------------
# 2. HOOKS
# ------------------------------------------------------------------
W "frontend\src\hooks\useOwnedCourses.ts" @'
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { enrollmentsApi } from "../api/enrollments"
import { useAuthStore } from "../stores/authStore"

export const enrollmentsKey = (userId: number | undefined) => ["enrollments", userId] as const

// Inscriptions de l'utilisateur connecte (la cle contient l'id : pas de melange entre comptes)
export function useEnrollments() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: enrollmentsKey(userId),
    queryFn: async () => (await enrollmentsApi.list()).data.data,
    enabled: userId !== undefined,
  })
}

// Map id du cours -> id de l'inscription, pour afficher "Acceder" au lieu de "Ajouter au panier"
export function useOwnedCourses(): Map<number, number> {
  const { data } = useEnrollments()
  return useMemo(() => {
    const owned = new Map<number, number>()
    for (const e of data ?? []) if (e.course) owned.set(e.course.id, e.id)
    return owned
  }, [data])
}
'@

# ------------------------------------------------------------------
# 3. COMPOSANTS
# ------------------------------------------------------------------
W "frontend\src\components\ProgressBar.tsx" @'
export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
'@

W "frontend\src\components\CourseCard.tsx" @'
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import AddToCartButton from "./AddToCartButton"
import { buttonClass } from "./Button"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Course } from "../types"

export function CourseCover({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-linear-to-br from-primary to-primary-dark text-primary-light ${className}`}>
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8l9-4 9 4-9 4-9-4z" />
        <path d="M7 10.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-5.5" />
        <path d="M21 8v6" />
      </svg>
    </div>
  )
}

interface Props {
  course: Course
  enrollmentId?: number
}

export default function CourseCard({ course, enrollmentId }: Props) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-lg">
      <Link to={`/formations/${course.slug}`} className="block" aria-label={course.title}>
        <CourseCover className="aspect-video" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link to={`/formations/${course.slug}`} className="line-clamp-2 text-base font-semibold hover:text-primary">
          {course.title}
        </Link>
        {course.description && <p className="line-clamp-2 text-sm text-muted">{course.description}</p>}
        <p className="text-lg font-extrabold text-primary">{formatPrice(course.price)}</p>
        <div className="mt-auto pt-1">
          {enrollmentId !== undefined ? (
            <Link to={`/mes-formations/${enrollmentId}`} className={buttonClass({ full: true })}>{t("courses.access")}</Link>
          ) : (
            <AddToCartButton type="course" id={course.id} />
          )}
        </div>
      </div>
    </article>
  )
}
'@

W "frontend\src\components\CoursesPreview.tsx" @'
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import CourseCard from "./CourseCard"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

// Apercu des formations sur l'accueil : n'affiche rien s'il n'y en a pas
export default function CoursesPreview() {
  const { t } = useTranslation()
  const owned = useOwnedCourses()
  const { data } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await catalogApi.courses()).data,
  })

  if (!data || data.data.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold sm:text-2xl">{t("courses.home_title")}</h2>
        <Link to="/formations" className="text-sm font-semibold text-primary">{t("courses.see_all")}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {data.data.slice(0, 3).map((course) => (
          <CourseCard key={course.id} course={course} enrollmentId={owned.get(course.id)} />
        ))}
      </div>
    </section>
  )
}
'@

W "frontend\src\components\CoursePlayer.tsx" @'
import { useCallback, useEffect, useRef, useState } from "react"

interface PlayerMessage {
  context?: string
  event?: string
  value?: { seconds: number; duration: number }
}

interface Props {
  embedUrl: string
  title: string
  onTime: (seconds: number, duration: number) => void
  onEnded: () => void
}

// Lecteur Bunny Stream (iframe) + suivi de lecture via le protocole Player.js (postMessage)
export default function CoursePlayer({ embedUrl, title, onTime, onEnded }: Props) {
  // Fige l'URL : un nouveau jeton (rechargement des donnees) ne doit pas relancer la video
  const [src] = useState(embedUrl)
  const frame = useRef<HTMLIFrameElement>(null)

  const subscribe = useCallback(() => {
    const send = (method: string, value: string) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ context: "player.js", version: "0.0.10", method, value }), "*")
    send("addEventListener", "timeupdate")
    send("addEventListener", "ended")
  }, [])

  useEffect(() => {
    function handle(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return
      let msg: unknown = e.data
      if (typeof msg === "string") {
        try {
          msg = JSON.parse(msg)
        } catch {
          return
        }
      }
      if (typeof msg !== "object" || msg === null) return
      const m = msg as PlayerMessage
      if (m.context !== "player.js") return
      if (m.event === "ready") subscribe()
      else if (m.event === "timeupdate" && m.value && m.value.duration > 0) onTime(m.value.seconds, m.value.duration)
      else if (m.event === "ended") onEnded()
    }
    window.addEventListener("message", handle)
    return () => window.removeEventListener("message", handle)
  }, [onTime, onEnded, subscribe])

  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black shadow-card">
      <iframe
        ref={frame}
        src={src}
        title={title}
        loading="lazy"
        onLoad={subscribe}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  )
}
'@

# ------------------------------------------------------------------
# 4. PAGES
# ------------------------------------------------------------------
W "frontend\src\pages\CoursesPage.tsx" @'
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import CourseCard from "../components/CourseCard"
import { EmptyState, ErrorState } from "../components/States"
import { ProductGridSkeleton } from "../components/Skeleton"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

export default function CoursesPage() {
  const { t } = useTranslation()
  const owned = useOwnedCourses()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await catalogApi.courses()).data,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("courses.title")}</h1>
      {isLoading && <ProductGridSkeleton count={6} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("courses.empty")} />}
      {data && data.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {data.data.map((course) => (
            <CourseCard key={course.id} course={course} enrollmentId={owned.get(course.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
'@

W "frontend\src\pages\CourseDetailPage.tsx" @'
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "../components/AddToCartButton"
import { buttonClass } from "../components/Button"
import { CourseCover } from "../components/CourseCard"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton } from "../components/Skeleton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { useOwnedCourses } from "../hooks/useOwnedCourses"

function CourseAction({ courseId, enrollmentId }: { courseId: number; enrollmentId?: number }) {
  const { t } = useTranslation()
  if (enrollmentId !== undefined) {
    return <Link to={`/mes-formations/${enrollmentId}`} className={buttonClass({ full: true })}>{t("courses.access")}</Link>
  }
  return <AddToCartButton type="course" id={courseId} />
}

export default function CourseDetailPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const owned = useOwnedCourses()
  const { slug = "" } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => (await catalogApi.course(slug)).data.data,
    enabled: slug !== "",
  })

  if (isLoading) return <ProductDetailSkeleton />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const enrollmentId = owned.get(data.id)

  return (
    <div className="pb-24 lg:pb-0">
      <Link to="/formations" className="inline-flex min-h-[44px] items-center text-sm text-muted hover:text-ink">
        ← {t("courses.back")}
      </Link>
      <div className="mt-2 grid gap-6 lg:mt-4 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <CourseCover className="aspect-[4/3] rounded-card shadow-card sm:aspect-video" />
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{data.title}</h1>
          {enrollmentId !== undefined ? (
            <p className="mt-2 text-sm font-semibold text-primary lg:hidden">{t("courses.owned")}</p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-primary lg:hidden">{formatPrice(data.price)}</p>
          )}
          <h2 className="mt-6 text-lg font-semibold">{t("courses.description")}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">
            {data.description || t("courses.no_description")}
          </p>
        </div>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          {enrollmentId !== undefined ? (
            <p className="text-sm font-semibold text-primary">{t("courses.owned")}</p>
          ) : (
            <p className="text-3xl font-extrabold text-primary">{formatPrice(data.price)}</p>
          )}
          <div className="mt-4">
            <CourseAction courseId={data.id} enrollmentId={enrollmentId} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          {enrollmentId === undefined && <p className="text-xl font-extrabold text-primary">{formatPrice(data.price)}</p>}
          <div className="flex-1">
            <CourseAction courseId={data.id} enrollmentId={enrollmentId} />
          </div>
        </div>
      </div>
    </div>
  )
}
'@

W "frontend\src\pages\MyCoursesPage.tsx" @'
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { downloadCertificate } from "../api/enrollments"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button, { buttonClass } from "../components/Button"
import ProgressBar from "../components/ProgressBar"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import { useEnrollments } from "../hooks/useOwnedCourses"
import type { Enrollment } from "../types"

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const { t } = useTranslation()
  const completed = enrollment.progress >= 100 || !!enrollment.completed_at
  const cert = enrollment.certificate ?? null
  const action = completed ? t("courses.review") : enrollment.progress > 0 ? t("courses.continue") : t("courses.start")

  async function handleDownload(id: number) {
    try {
      await downloadCertificate(id)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold">{enrollment.course?.title ?? t("courses.title")}</p>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${completed ? "bg-primary/10 text-primary" : "bg-line text-muted"}`}>
          {completed ? t("courses.completed") : t("courses.in_progress")}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={enrollment.progress} />
        <span className="w-10 shrink-0 text-right text-sm text-muted">{Math.round(enrollment.progress)}%</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to={`/mes-formations/${enrollment.id}`} className={buttonClass({ className: "w-full sm:w-auto" })}>{action}</Link>
        {cert && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void handleDownload(cert.id)}>
            {t("courses.certificate_download")}
          </Button>
        )}
      </div>
    </li>
  )
}

export default function MyCoursesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useEnrollments()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("courses.my_title")}</h1>
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("courses.my_empty")} actionTo="/formations" actionLabel={t("courses.browse")} />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </ul>
      )}
    </div>
  )
}
'@

W "frontend\src\pages\CoursePlayerPage.tsx" @'
import { useCallback, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { downloadCertificate, enrollmentsApi } from "../api/enrollments"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import Button from "../components/Button"
import CoursePlayer from "../components/CoursePlayer"
import ProgressBar from "../components/ProgressBar"
import { ErrorState } from "../components/States"
import { ProductDetailSkeleton, Skeleton } from "../components/Skeleton"
import type { Enrollment } from "../types"

export default function CoursePlayerPage() {
  const { t } = useTranslation()
  const { id = "" } = useParams()
  const enrollmentId = Number(id)
  const userId = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()
  const key = useMemo(() => ["enrollment", userId, enrollmentId] as const, [userId, enrollmentId])
  const busy = useRef(false)
  const lastAt = useRef(0)

  const enrollmentQuery = useQuery({
    queryKey: key,
    queryFn: async () => (await enrollmentsApi.show(enrollmentId)).data.data,
    enabled: Number.isInteger(enrollmentId) && enrollmentId > 0,
  })
  const enrollment = enrollmentQuery.data
  const slug = enrollment?.course?.slug

  // La route playback identifie le cours par son slug
  const playbackQuery = useQuery({
    queryKey: ["playback", slug],
    queryFn: async () => (await enrollmentsApi.playback(slug ?? "")).data.data.playback,
    enabled: !!slug,
    retry: false,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Les reponses de progression ne contiennent pas toujours le cours : on fusionne au lieu de remplacer
  const merge = useCallback(
    (e: Enrollment) => {
      queryClient.setQueryData<Enrollment>(key, (old) =>
        old ? { ...old, progress: e.progress, completed_at: e.completed_at, certificate: e.certificate ?? old.certificate } : old,
      )
      if (e.completed_at || e.progress >= 100) void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ["enrollments"] })
    },
    [queryClient, key],
  )

  // Envoie la progression au plus toutes les 15 s, jamais en arriere ; un refus (trop rapide) est ignore
  const report = useCallback(
    async (pct: number) => {
      const known = queryClient.getQueryData<Enrollment>(key)?.progress ?? 0
      const now = Date.now()
      if (pct <= known || busy.current) return
      if (pct < 100 && now - lastAt.current < 15_000) return
      busy.current = true
      lastAt.current = now
      try {
        const { data } = await enrollmentsApi.updateProgress(enrollmentId, pct)
        merge(data.data)
      } catch {
        // refuse par le serveur : on reessaiera au prochain tick
      } finally {
        busy.current = false
      }
    },
    [queryClient, key, enrollmentId, merge],
  )

  const onTime = useCallback(
    (seconds: number, duration: number) => {
      void report(Math.min(99, Math.floor((seconds / duration) * 100)))
    },
    [report],
  )
  const onEnded = useCallback(() => {
    void report(100)
  }, [report])

  const complete = useMutation({
    mutationFn: async () => (await enrollmentsApi.complete(enrollmentId)).data.data,
    onSuccess: (e) => {
      merge(e)
      toast.success(t("courses.completed_toast"))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const issue = useMutation({
    mutationFn: async () => (await enrollmentsApi.issueCertificate(enrollmentId)).data.data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (enrollmentQuery.isLoading) return <ProductDetailSkeleton />
  if (enrollmentQuery.error || !enrollment) {
    return <ErrorState error={enrollmentQuery.error} onRetry={() => void enrollmentQuery.refetch()} />
  }

  const course = enrollment.course
  const completed = enrollment.progress >= 100 || !!enrollment.completed_at
  const cert = enrollment.certificate ?? null

  async function handleDownload(certId: number) {
    try {
      await downloadCertificate(certId)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div>
      <Link to="/mes-formations" className="inline-flex min-h-[44px] items-center text-sm text-muted hover:text-ink">
        ← {t("courses.back_my")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{course?.title}</h1>

      <div className="mt-4">
        {playbackQuery.isLoading && <Skeleton className="aspect-video w-full rounded-card" />}
        {playbackQuery.error && <ErrorState error={playbackQuery.error} onRetry={() => void playbackQuery.refetch()} />}
        {playbackQuery.data && (
          <CoursePlayer embedUrl={playbackQuery.data.embed_url} title={course?.title ?? ""} onTime={onTime} onEnded={onEnded} />
        )}
      </div>

      <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{t("courses.progress")}</span>
          <ProgressBar value={enrollment.progress} />
          <span className="w-10 shrink-0 text-right text-sm text-muted">{Math.round(enrollment.progress)}%</span>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {!completed && (
            <Button variant="secondary" className="w-full sm:w-auto" loading={complete.isPending} onClick={() => complete.mutate()}>
              {t("courses.mark_done")}
            </Button>
          )}
          {completed && cert && (
            <Button className="w-full sm:w-auto" onClick={() => void handleDownload(cert.id)}>
              {t("courses.certificate_download")}
            </Button>
          )}
          {completed && !cert && (
            <Button className="w-full sm:w-auto" loading={issue.isPending} onClick={() => issue.mutate()}>
              {t("courses.certificate_get")}
            </Button>
          )}
        </div>
      </div>

      {course?.description && (
        <>
          <h2 className="mt-6 text-lg font-semibold">{t("courses.description")}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{course.description}</p>
        </>
      )}
    </div>
  )
}
'@

# ------------------------------------------------------------------
# 5. ROUTES
# ------------------------------------------------------------------
$app = "frontend\src\App.tsx"
Rep $app 'const OrdersPage = lazy(() => import("./pages/OrdersPage"))' ('const OrdersPage = lazy(() => import("./pages/OrdersPage"))' + "`n" + 'const CoursesPage = lazy(() => import("./pages/CoursesPage"))' + "`n" + 'const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"))' + "`n" + 'const MyCoursesPage = lazy(() => import("./pages/MyCoursesPage"))' + "`n" + 'const CoursePlayerPage = lazy(() => import("./pages/CoursePlayerPage"))')

Rep $app '<Route path="boutique/:slug" element={<ProductDetailPage />} />' ('<Route path="boutique/:slug" element={<ProductDetailPage />} />' + "`n" + '          <Route path="formations" element={<CoursesPage />} />' + "`n" + '          <Route path="formations/:slug" element={<CourseDetailPage />} />' + "`n" + '          <Route path="mes-formations" element={<RequireAuth><MyCoursesPage /></RequireAuth>} />' + "`n" + '          <Route path="mes-formations/:id" element={<RequireAuth><CoursePlayerPage /></RequireAuth>} />')

# ------------------------------------------------------------------
# 6. NAVIGATION + ACCUEIL
# ------------------------------------------------------------------
$nav = "frontend\src\components\Navbar.tsx"
Rep $nav '<NavLink to="/boutique" className={desktopLink}>{t("nav.shop")}</NavLink>' ('<NavLink to="/boutique" className={desktopLink}>{t("nav.shop")}</NavLink>' + "`n          " + '<NavLink to="/formations" className={desktopLink}>{t("nav.courses")}</NavLink>')
Rep $nav '<NavLink to="/commandes" className={desktopLink}>{t("nav.my_orders")}</NavLink>' ('<NavLink to="/mes-formations" className={desktopLink}>{t("nav.my_courses")}</NavLink>' + "`n              " + '<NavLink to="/commandes" className={desktopLink}>{t("nav.my_orders")}</NavLink>')

$bn = "frontend\src\components\BottomNav.tsx"
Rep $bn 'user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon>,' ('user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Icon>,' + "`n" + '  courses: <Icon><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M7 10.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-5.5" /></Icon>,')
Rep $bn '<Tab to="/boutique" label={t("nav.shop")} icon={icons.shop} />' ('<Tab to="/boutique" label={t("nav.shop")} icon={icons.shop} />' + "`n          " + '<Tab to="/formations" label={t("nav.courses")} icon={icons.courses} />')
$myCoursesLink = @'
{user && (
              <NavLink to="/mes-formations" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60">
                {t("nav.my_courses")}
              </NavLink>
            )}
            {user?.is_admin && (
'@
Rep $bn '{user?.is_admin && (' $myCoursesLink.TrimEnd()

$home = "frontend\src\pages\HomePage.tsx"
Rep $home 'import { ProductGridSkeleton } from "../components/Skeleton"' ('import { ProductGridSkeleton } from "../components/Skeleton"' + "`n" + 'import CoursesPreview from "../components/CoursesPreview"')
Rep $home '<section>' ('<CoursesPreview />' + "`n`n      " + '<section>')

# ------------------------------------------------------------------
# 7. TRADUCTIONS
# ------------------------------------------------------------------
$frCourses = @'
  "courses": {
    "title": "Formations", "empty": "Aucune formation disponible pour le moment.", "back": "Retour aux formations", "description": "Description", "no_description": "Aucune description pour cette formation.",
    "owned": "Vous possédez cette formation", "access": "Accéder à la formation", "home_title": "Nos formations", "see_all": "Voir toutes les formations",
    "my_title": "Mes formations", "my_empty": "Vous n'avez pas encore de formation.", "browse": "Découvrir les formations", "progress": "Progression",
    "completed": "Terminée", "in_progress": "En cours", "start": "Commencer", "continue": "Continuer", "review": "Revoir",
    "certificate_download": "Télécharger mon certificat", "certificate_get": "Obtenir mon certificat", "mark_done": "Marquer comme terminée",
    "completed_toast": "Formation terminée, bravo !", "back_my": "Retour à mes formations"
  },
'@
$enCourses = @'
  "courses": {
    "title": "Courses", "empty": "No courses available at the moment.", "back": "Back to courses", "description": "Description", "no_description": "No description for this course.",
    "owned": "You own this course", "access": "Go to the course", "home_title": "Our courses", "see_all": "See all courses",
    "my_title": "My courses", "my_empty": "You don't have any course yet.", "browse": "Discover the courses", "progress": "Progress",
    "completed": "Completed", "in_progress": "In progress", "start": "Start", "continue": "Continue", "review": "Review",
    "certificate_download": "Download my certificate", "certificate_get": "Get my certificate", "mark_done": "Mark as completed",
    "completed_toast": "Course completed, congratulations!", "back_my": "Back to my courses"
  },
'@
$frShop = '"shop": { "title": "Boutique", "empty": "Aucun produit disponible pour le moment." },'
$enShop = '"shop": { "title": "Shop", "empty": "No products available at the moment." },'
Rep "frontend\src\i18n\locales\fr.json" $frShop ($frShop + "`n" + $frCourses.TrimEnd())
Rep "frontend\src\i18n\locales\en.json" $enShop ($enShop + "`n" + $enCourses.TrimEnd())
Rep "frontend\src\i18n\locales\fr.json" '"account": "Compte", "main": "Navigation principale"' '"account": "Compte", "main": "Navigation principale", "courses": "Formations", "my_courses": "Mes formations"'
Rep "frontend\src\i18n\locales\en.json" '"account": "Account", "main": "Main navigation"' '"account": "Account", "main": "Main navigation", "courses": "Courses", "my_courses": "My courses"'

# ------------------------------------------------------------------
# 8. VERIFICATIONS
# ------------------------------------------------------------------
foreach ($j in "fr","en") {
    try { [IO.File]::ReadAllText("C:\Unix\frontend\src\i18n\locales\$j.json") | ConvertFrom-Json | Out-Null; "JSON $j.json : OK" }
    catch { Write-Warning "JSON $j.json invalide : $_" }
}

Set-Location C:\Unix\frontend
npm run build
Set-Location C:\Unix