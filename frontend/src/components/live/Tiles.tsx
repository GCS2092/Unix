import { useEffect, useRef, type ReactNode } from "react"
import { Track, type Participant } from "livekit-client"
import { useLiveText } from "../../lib/liveText"

export function Ico({ children, cls = "h-5 w-5" }: { children: ReactNode; cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const micPath = (
  <>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </>
)
const camPath = (
  <>
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </>
)

export const I = {
  mic: <Ico>{micPath}</Ico>,
  micOff: <Ico>{micPath}<path d="M2 2l20 20" /></Ico>,
  micSm: <Ico cls="h-4 w-4">{micPath}</Ico>,
  micOffSm: <Ico cls="h-4 w-4">{micPath}<path d="M2 2l20 20" /></Ico>,
  cam: <Ico>{camPath}</Ico>,
  camOff: <Ico>{camPath}<path d="M2 2l20 20" /></Ico>,
  screen: <Ico><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></Ico>,
  gear: <Ico><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Ico>,
  expand: <Ico><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Ico>,
}

export function initials(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase()
}

interface TileProps {
  p: Participant
  source?: Track.Source
  label?: string
  host?: boolean
  me?: boolean
}

export function VideoTile({ p, source = Track.Source.Camera, label, host, me }: TileProps) {
  const L = useLiveText()
  const ref = useRef<HTMLVideoElement>(null)
  const pub = p.getTrackPublication(source)
  const track = pub?.track
  const screen = source === Track.Source.ScreenShare
  const showVideo = !!track && !pub?.isMuted
  const name = p.name || p.identity

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return (
    <div className={`relative aspect-video overflow-hidden rounded-card bg-black ${p.isSpeaking && !screen ? "ring-2 ring-primary" : ""}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full ${screen ? "object-contain" : "object-cover"} ${me && !screen ? "scale-x-[-1]" : ""} ${showVideo ? "" : "hidden"}`}
      />
      {!showVideo && !screen && (
        <div className="absolute inset-0 grid place-items-center bg-ink/90">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-lg font-bold text-white">{initials(name)}</span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex max-w-[92%] items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
        {!screen && !p.isMicrophoneEnabled && I.micOffSm}
        <span className="truncate">{label ?? name}{me && !label ? ` (${L.you})` : ""}</span>
        {host && <span className="rounded bg-primary px-1 text-[10px] font-bold uppercase">{L.host}</span>}
      </div>
    </div>
  )
}

export function AudioSink({ p, source }: { p: Participant; source: Track.Source }) {
  const ref = useRef<HTMLAudioElement>(null)
  const track = p.getTrackPublication(source)?.track

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return <audio ref={ref} autoPlay />
}