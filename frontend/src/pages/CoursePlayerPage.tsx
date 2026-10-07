import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi, downloadCertificate } from "../api/courses"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "../components/Button"
import ProgressBar from "../components/ProgressBar"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import LiveRoom from "../components/LiveRoom"
import { useLiveStatus } from "../lib/useLiveStatus"

interface PlayerMsg {
  context?: string
  event?: string
  value?: { seconds: number; duration: number }
}

function originOf(url: string | null): string {
  try {
    return url ? new URL(url).origin : "*"
  } catch {
    return "*"
  }
}

function send(frame: HTMLIFrameElement | null, origin: string, method: string, value?: string) {
  frame?.contentWindow?.postMessage(
    JSON.stringify({ context: "player.js", version: "0.0.11", method, value, listener: value }),
    origin,
  )
}

export default function CoursePlayerPage() {
  const { id } = useParams()
  const enrollmentId = Number(id)
  const validId = Number.isInteger(enrollmentId) && enrollmentId > 0
  const { t } = useTranslation()
  const qc = useQueryClient()

  const enr = useQuery({
    queryKey: ["enrollment", enrollmentId],
    queryFn: async () => (await coursesApi.show(enrollmentId)).data.data,
    enabled: validId,
  })
  const slug = enr.data?.course?.slug
  const liveStatus = useLiveStatus()

  // Une URL signée par visite : on ne la redemande pas en cours de lecture
  const play = useQuery({
    queryKey: ["playback", slug],
    queryFn: async () => (await coursesApi.playback(slug as string)).data.data.playback,
    enabled: !!slug,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // On fige l'URL : un rechargement de données ne doit pas relancer la vidéo
  const [src, setSrc] = useState<string | null>(null)
  if (play.data?.embed_url && !src) setSrc(play.data.embed_url)

  const frame = useRef<HTMLIFrameElement>(null)
  const best = useRef(0)
  const sent = useRef(0)
  const [progress, setProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const origin = originOf(src)

  useEffect(() => {
    if (!enr.data) return
    best.current = Math.max(best.current, enr.data.progress)
    sent.current = Math.max(sent.current, enr.data.progress)
    setProgress(best.current)
  }, [enr.data])

  useEffect(() => {
    if (!validId) return
    const flush = () => {
      if (best.current <= sent.current) return
      void coursesApi
        .progress(enrollmentId, best.current)
        .then((res) => {
          sent.current = Math.max(sent.current, res.data.data.progress)
          qc.setQueryData(["enrollment", enrollmentId], res.data.data)
          void qc.invalidateQueries({ queryKey: ["my-enrollments"] })
        })
        .catch(() => {
          // Règle anti-triche côté serveur (progression trop rapide) : on réessaie au prochain cycle
        })
    }
    const subscribe = () => {
      send(frame.current, origin, "addEventListener", "timeupdate")
      send(frame.current, origin, "addEventListener", "ended")
    }

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      let d: PlayerMsg
      try {
        d = (typeof e.data === "string" ? JSON.parse(e.data) : e.data) as PlayerMsg
      } catch {
        return
      }
      if (!d || d.context !== "player.js") return
      if (d.event === "ready") subscribe()
      else if (d.event === "timeupdate" && d.value && d.value.duration > 0) {
        const pct = Math.min(100, Math.floor((d.value.seconds / d.value.duration) * 100))
        if (pct > best.current) {
          best.current = pct
          setProgress(pct)
        }
      } else if (d.event === "ended") {
        best.current = 100
        setProgress(100)
        flush()
      }
    }

    window.addEventListener("message", onMessage)
    const timer = window.setInterval(flush, 20000)
    return () => {
      window.removeEventListener("message", onMessage)
      window.clearInterval(timer)
      flush()
    }
  }, [enrollmentId, validId, origin, qc])

  const issue = useMutation({
    mutationFn: () => coursesApi.issueCertificate(enrollmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] })
      void qc.invalidateQueries({ queryKey: ["my-enrollments"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  async function handleDownload(certificateId: number) {
    setDownloading(true)
    try {
      await downloadCertificate(certificateId)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  if (!validId) {
    return <EmptyState message={t("common.not_found")} actionTo="/etudiant" actionLabel={t("learn.back")} />
  }
  if (enr.isLoading) return <ListSkeleton rows={2} />
  if (enr.error) return <ErrorState error={enr.error} onRetry={() => void enr.refetch()} />

  // Le certificat dépend de ce que le serveur a validé, pas de la progression locale
  const serverDone = (enr.data?.progress ?? 0) >= 100 || !!enr.data?.completed_at
  const certificate = enr.data?.certificate
  const videoMessage = play.isLoading
    ? t("learn.loading_video")
    : play.error
      ? getErrorMessage(play.error)
      : t("learn.no_video")

  return (
    <div>
      <Link to="/etudiant" className="text-sm font-semibold text-primary">← {t("learn.back")}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold sm:text-2xl">{enr.data?.course?.title}</h1>

      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black shadow-card">
        {src ? (
          <iframe
            ref={frame}
            src={src}
            title={enr.data?.course?.title ?? "video"}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => {
              send(frame.current, origin, "addEventListener", "timeupdate")
              send(frame.current, origin, "addEventListener", "ended")
            }}
          />
        ) : (
          <p role={play.error ? "alert" : "status"} className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white">
            {videoMessage}
          </p>
        )}
      </div>
      {play.error && !src && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" loading={play.isFetching} onClick={() => void play.refetch()}>
            {t("states.retry")}
          </Button>
        </div>
      )}

      {(enr.data?.course?.has_live || enr.data?.course?.livekit_room) && (
        <div className="mt-4"><LiveRoom courseId={enr.data.course.id} live={liveStatus.isLive(enr.data.course.id)} /></div>
      )}

      <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold">{t("learn.progress")}</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
        <p className="mt-2 text-xs text-muted">{t("learn.player_hint")}</p>
        {serverDone && (
          <div className="mt-3">
            {certificate ? (
              <Button size="sm" loading={downloading} onClick={() => void handleDownload(certificate.id)}>
                {t("learn.certificate_download")}
              </Button>
            ) : (
              <Button size="sm" loading={issue.isPending} onClick={() => issue.mutate()}>
                {t("learn.certificate_get")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}