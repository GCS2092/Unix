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