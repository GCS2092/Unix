import { useCallback, useEffect, useRef, useState } from "react"
import { useLiveText } from "../../lib/liveText"
import { canMedia, isInsecure, mediaError } from "../../lib/liveMedia"
import Button from "../Button"
import { I } from "./tileIcons"

export interface JoinOptions {
  mic: boolean
  cam: boolean
  micId?: string
  camId?: string
}

export default function Lobby({ busy, onJoin }: { busy: boolean; onJoin: (o: JoinOptions) => void }) {
  const L = useLiveText()
  const [mic, setMic] = useState(canMedia)
  const [cam, setCam] = useState(canMedia)
  const [micId, setMicId] = useState("")
  const [camId, setCamId] = useState("")
  const [cams, setCams] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [rawLevel, setLevel] = useState(0)
  const [err, setErr] = useState<string | null>(isInsecure() ? L.errInsecure : null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const refresh = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setCams(all.filter((d) => d.kind === "videoinput"))
      setMics(all.filter((d) => d.kind === "audioinput"))
    } catch {
      // liste indisponible : on garde les peripheriques par defaut
    }
  }, [])

  useEffect(() => {
    if (!canMedia) return
    void Promise.resolve().then(refresh)
    navigator.mediaDevices.addEventListener("devicechange", refresh)
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh)
  }, [refresh])

  // Apercu de la camera
  useEffect(() => {
    const el = videoRef.current
    if (!cam || !canMedia) return
    let stream: MediaStream | null = null
    let dead = false
    navigator.mediaDevices
      .getUserMedia({ video: camId ? { deviceId: { exact: camId } } : true })
      .then((s) => {
        if (dead) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (el) {
          el.srcObject = s
          void el.play().catch(() => undefined)
        }
        setErr(null)
        void refresh()
      })
      .catch((e: unknown) => {
        setErr(mediaError(e, L))
        setCam(false)
      })
    return () => {
      dead = true
      stream?.getTracks().forEach((t) => t.stop())
      if (el) el.srcObject = null
    }
  }, [cam, camId, refresh, L])

  const level = mic && canMedia ? rawLevel : 0

  // Jauge du micro
  useEffect(() => {
    if (!mic || !canMedia) return
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    let dead = false
    navigator.mediaDevices
      .getUserMedia({ audio: micId ? { deviceId: { exact: micId } } : true })
      .then((s) => {
        if (dead) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        ctx.createMediaStreamSource(s).connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i]
          setLevel(Math.min(100, Math.round((sum / buf.length) * 1.6)))
          raf = requestAnimationFrame(tick)
        }
        tick()
        setErr(null)
        void refresh()
      })
      .catch((e: unknown) => {
        setErr(mediaError(e, L))
        setMic(false)
      })
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close().catch(() => undefined)
    }
  }, [mic, micId, refresh, L])

  const toggleCls = (on: boolean) =>
    `grid h-11 w-11 place-items-center rounded-full border transition ${on ? "border-line bg-surface text-ink" : "border-danger bg-danger text-white"}`

  return (
    <div>
      <h3 className="font-semibold">{L.lobbyTitle}</h3>
      <p className="mb-3 text-sm text-muted">{L.lobbyHint}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-card bg-black">
          <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full scale-x-[-1] object-cover ${cam ? "" : "hidden"}`} />
          {!cam && <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white">{L.previewOff}</p>}
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-3">
            <button type="button" onClick={() => setMic((v) => !v)} aria-pressed={mic} aria-label={L.microphone} disabled={!canMedia} className={toggleCls(mic)}>
              {mic ? I.mic : I.micOff}
            </button>
            <button type="button" onClick={() => setCam((v) => !v)} aria-pressed={cam} aria-label={L.camera} disabled={!canMedia} className={toggleCls(cam)}>
              {cam ? I.cam : I.camOff}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="lobby-cam" className="block text-sm font-semibold">{L.camera}</label>
            <select id="lobby-cam" value={camId} onChange={(e) => setCamId(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm">
              <option value="">{L.defaultDevice}</option>
              {cams.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${L.camera} ${i + 1}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lobby-mic" className="block text-sm font-semibold">{L.microphone}</label>
            <select id="lobby-mic" value={micId} onChange={(e) => setMicId(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm">
              <option value="">{L.defaultDevice}</option>
              {mics.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${L.microphone} ${i + 1}`}</option>
              ))}
            </select>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="meter" aria-label={L.micLevel} aria-valuenow={level} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${level}%` }} />
            </div>
          </div>
          {err && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
          <Button loading={busy} onClick={() => onJoin({ mic, cam, micId: micId || undefined, camId: camId || undefined })}>
            {L.joinNow}
          </Button>
        </div>
      </div>
    </div>
  )
}