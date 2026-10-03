import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi, downloadCertificate } from "../api/courses"
import { toast } from "../stores/toastStore"
import { buttonClass } from "../components/Button"
import { ErrorState } from "../components/States"
import { Bar } from "./MyCoursesPage"

interface PlayerMsg {
  context?: string
  event?: string
  value?: { seconds: number; duration: number }
}

function embedUrl(p: unknown): string | null {
  if (typeof p === "string") return p
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>
    for (const k of ["embed_url", "url", "embedUrl"]) {
      if (typeof o[k] === "string") return o[k] as string
    }
  }
  return null
}

const send = (frame: HTMLIFrameElement | null, method: string, value?: string) =>
  frame?.contentWindow?.postMessage(
    JSON.stringify({ context: "player.js", version: "0.0.11", method, value, listener: value }),
    "*",
  )

export default function CoursePlayerPage() {
  const { id } = useParams()
  const enrollmentId = Number(id)
  const { t } = useTranslation()
  const qc = useQueryClient()

  const enr = useQuery({
    queryKey: ["enrollment", enrollmentId],
    queryFn: async () => (await coursesApi.show(enrollmentId)).data.data,
    enabled: Number.isFinite(enrollmentId),
  })
  const slug = enr.data?.course?.slug
  const play = useQuery({
    queryKey: ["playback", slug],
    queryFn: async () => (await coursesApi.playback(slug as string)).data.data.playback,
    enabled: !!slug,
    staleTime: 0,
    retry: false,
  })

  const frame = useRef<HTMLIFrameElement>(null)
  const best = useRef(0)
  const sent = useRef(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!enr.data) return
    best.current = Math.max(best.current, enr.data.progress)
    sent.current = Math.max(sent.current, enr.data.progress)
    setProgress(best.current)
  }, [enr.data])

  useEffect(() => {
    const flush = () => {
      if (best.current <= sent.current) return
      void coursesApi
        .progress(enrollmentId, best.current)
        .then((res) => {
          sent.current = Math.max(sent.current, res.data.data.progress)
          qc.setQueryData(["enrollment", enrollmentId], res.data.data)
          void qc.invalidateQueries({ queryKey: ["my-enrollments"] })
        })
        .catch(() => { /* règle anti-triche : on réessaie au prochain cycle */ })
    }
    const subscribe = () => { send(frame.current, "addEventListener", "timeupdate"); send(frame.current, "addEventListener", "ended") }

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      let d: PlayerMsg
      try { d = (typeof e.data === "string" ? JSON.parse(e.data) : e.data) as PlayerMsg } catch { return }
      if (!d || d.context !== "player.js") return
      if (d.event === "ready") subscribe()
      else if (d.event === "timeupdate" && d.value && d.value.duration > 0) {
        const pct = Math.min(100, Math.floor((d.value.seconds / d.value.duration) * 100))
        if (pct > best.current) { best.current = pct; setProgress(pct) }
      } else if (d.event === "ended") {
        best.current = 100
        setProgress(100)
        flush()
      }
    }

    window.addEventListener("message", onMessage)
    const timer = window.setInterval(flush, 20000)
    return () => { window.removeEventListener("message", onMessage); window.clearInterval(timer); flush() }
  }, [enrollmentId, qc])

  const issue = useMutation({
    mutationFn: () => coursesApi.issueCertificate(enrollmentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] }),
    onError: () => toast.error(t("learn.certificate_error")),
  })

  if (enr.error) return <ErrorState error={enr.error} onRetry={() => void enr.refetch()} />
  const src = embedUrl(play.data)
  const done = progress >= 100
  const certificate = enr.data?.certificate

  return (
    <div>
      <Link to="/mes-cours" className="text-sm font-semibold text-primary">← {t("learn.back")}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold sm:text-2xl">{enr.data?.course?.title}</h1>

      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black shadow-card">
        {src && (
          <iframe ref={frame} src={src} title={enr.data?.course?.title ?? "video"} className="absolute inset-0 h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            onLoad={() => { send(frame.current, "addEventListener", "timeupdate"); send(frame.current, "addEventListener", "ended") }} />
        )}
        {!src && play.isLoading && <p className="absolute inset-0 grid place-items-center text-sm text-white">{t("learn.loading_video")}</p>}
        {!src && !play.isLoading && <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white">{t("learn.no_video")}</p>}
      </div>
      {play.error && <ErrorState error={play.error} onRetry={() => void play.refetch()} />}

      <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold">{t("learn.progress")}</span><span>{progress}%</span>
        </div>
        <Bar value={progress} />
        <p className="mt-2 text-xs text-muted">{t("learn.player_hint")}</p>
        {done && (
          <div className="mt-3">
            {certificate ? (
              <button type="button" className={buttonClass({ size: "sm" })}
                onClick={() => void downloadCertificate(certificate.id).catch(() => toast.error(t("learn.certificate_error")))}>
                {t("learn.certificate_download")}
              </button>
            ) : (
              <button type="button" className={buttonClass({ size: "sm" })} disabled={issue.isPending} onClick={() => issue.mutate()}>
                {t("learn.certificate_get")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}