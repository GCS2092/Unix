import { useEffect, useRef } from "react"
import { Track, type Participant } from "livekit-client"
import { useLiveText } from "../../lib/liveText"
import { I, initials } from "./tileIcons"

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