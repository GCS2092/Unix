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
        â† {t("courses.back_my")}
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