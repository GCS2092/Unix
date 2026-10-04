import { useState } from "react"
import { useLiveText } from "../../lib/liveText"
import Button from "../Button"

export default function ShareLink({ url, title }: { url: string; title: string }) {
  const L = useLiveText()
  const [copied, setCopied] = useState(false)
  const text = `${L.shareMessage} ${title}\n${url}`
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
  const mail = `mailto:?subject=${encodeURIComponent(`${L.shareSubject} ${title}`)}&body=${encodeURIComponent(text)}`
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function"

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const area = document.createElement("textarea")
      area.value = url
      document.body.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: L.shareMessage, url })
    } catch {
      // partage annule
    }
  }

  const linkCls = "inline-flex min-h-[44px] items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold hover:bg-page"

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="font-semibold">{L.shareTitle}</h2>
      <label htmlFor="live-link" className="mt-2 block text-xs font-medium text-muted">{L.shareLink}</label>
      <div className="mt-1 flex gap-2">
        <input
          id="live-link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-line bg-page px-3 text-sm"
        />
        <Button variant="secondary" onClick={() => void copy()}>{copied ? L.copied : L.copy}</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer" className={linkCls}>{L.shareWhatsapp}</a>
        <a href={mail} className={linkCls}>{L.shareEmail}</a>
        {canNative && <button type="button" onClick={() => void nativeShare()} className={linkCls}>{L.shareNative}</button>}
      </div>
      <p className="mt-3 text-xs text-muted">{L.shareOnlyEnrolled}</p>
    </div>
  )
}