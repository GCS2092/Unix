import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client"
import { liveApi } from "../api/courses"
import { getErrorMessage } from "../lib/errors"
import Button from "./Button"

type Phase = "idle" | "connecting" | "connected" | "reconnecting" | "ended" | "error"

export default function LiveRoom({ courseId }: { courseId: number }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const room = useRef<Room | null>(null)

  const leave = useCallback(() => {
    room.current?.disconnect()
    room.current = null
  }, [])

  // On quitte la salle en changeant de page
  useEffect(() => leave, [leave])

  async function join() {
    leave()
    setMessage(null)
    setHasVideo(false)
    setAudioBlocked(false)
    setPhase("connecting")

    const r = new Room({ adaptiveStream: true, dynacast: true })
    room.current = r

    r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
        const el = track.attach()
        if (track.kind === Track.Kind.Video) {
          el.className = "h-full w-full object-contain"
          setHasVideo(true)
        }
        stage.current?.appendChild(el)
      }
    })
    r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove())
      if (track.kind === Track.Kind.Video) setHasVideo(false)
    })
    r.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!r.canPlaybackAudio))
    r.on(RoomEvent.Reconnecting, () => setPhase("reconnecting"))
    r.on(RoomEvent.Reconnected, () => setPhase("connected"))
    r.on(RoomEvent.Disconnected, () => {
      if (room.current === r) {
        room.current = null
        setPhase("ended")
      }
    })

    try {
      const { data } = await liveApi.token(courseId)
      await r.connect(data.data.url, data.data.token)
      if (room.current !== r) return // l'utilisateur a quitté entre-temps
      await r.startAudio().catch(() => setAudioBlocked(true))
      setPhase("connected")
    } catch (e) {
      r.disconnect()
      if (room.current === r) room.current = null
      setMessage(getErrorMessage(e))
      setPhase("error")
    }
  }

  const active = phase === "connected" || phase === "reconnecting"

  return (
    <section className="mb-6 rounded-card border border-line bg-surface p-4 shadow-card" aria-label={t("learn.live_title", { defaultValue: "Session en direct" })}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("learn.live_title", { defaultValue: "Session en direct" })}</h2>
        {active && (
          <Button size="sm" variant="secondary" onClick={() => { leave(); setPhase("idle") }}>
            {t("learn.live_leave", { defaultValue: "Quitter" })}
          </Button>
        )}
      </div>

      {phase === "idle" && (
        <div>
          <p className="mb-3 text-sm text-muted">
            {t("learn.live_intro", { defaultValue: "Rejoignez la session pour suivre le direct avec le formateur." })}
          </p>
          <Button onClick={() => void join()}>{t("learn.live_join", { defaultValue: "Rejoindre le direct" })}</Button>
        </div>
      )}

      {phase === "connecting" && (
        <p role="status" className="py-6 text-center text-sm text-muted">
          {t("learn.live_connecting", { defaultValue: "Connexion à la session…" })}
        </p>
      )}

      {phase === "error" && (
        <div role="alert" className="rounded-lg bg-danger/10 px-3 py-3 text-sm text-danger">
          <p>{message}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => void join()}>
            {t("states.retry")}
          </Button>
        </div>
      )}

      {phase === "ended" && (
        <div role="status" className="py-4 text-center text-sm text-muted">
          <p>{t("learn.live_ended", { defaultValue: "La session est terminée ou la connexion a été interrompue." })}</p>
          <Button className="mt-3" size="sm" onClick={() => void join()}>
            {t("learn.live_rejoin", { defaultValue: "Se reconnecter" })}
          </Button>
        </div>
      )}

      {active && (
        <>
          <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black">
            <div ref={stage} className="absolute inset-0" />
            {!hasVideo && (
              <p role="status" className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white">
                {t("learn.live_waiting", { defaultValue: "En attente du formateur…" })}
              </p>
            )}
            {phase === "reconnecting" && (
              <p role="status" className="absolute inset-x-0 top-0 bg-ink/80 px-3 py-1.5 text-center text-xs text-white">
                {t("learn.live_reconnecting", { defaultValue: "Connexion instable, reconnexion…" })}
              </p>
            )}
          </div>
          {audioBlocked && (
            <Button className="mt-3" size="sm" onClick={() => void room.current?.startAudio().then(() => setAudioBlocked(false))}>
              {t("learn.live_enable_audio", { defaultValue: "Activer le son" })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}