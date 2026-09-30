import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react"
import { useTranslation } from "react-i18next"
import ProductImage from "./ProductImage"

interface Props { src?: string | null; alt: string; ratio?: string; className?: string }

export default function ImageZoom({ src, alt, ratio, className = "" }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [hover, setHover] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!src) return <ProductImage src={src} alt={alt} ratio={ratio} className={className} priority />

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    setHover(true)
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setZoomed(false); setOpen(true) }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={t("ux.zoom")}
        className={`cursor-zoom-in overflow-hidden ${className}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(false)}
        onKeyDown={onKeyDown}
        onClick={() => { setZoomed(false); setOpen(true) }}
      >
        <div className="transition-transform duration-200 ease-out" style={{ transform: hover ? "scale(1.8)" : "scale(1)", transformOrigin: origin }}>
          <ProductImage src={src} alt={alt} ratio={ratio} priority />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/90" role="dialog" aria-modal="true" aria-label={alt}>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
            className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl text-ink active:scale-95"
          >
            ✕
          </button>
          <div className="flex h-full w-full overflow-auto" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
            <img
              src={src}
              alt={alt}
              onClick={() => setZoomed((z) => !z)}
              className={`m-auto select-none ${zoomed ? "w-[250%] max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}`}
            />
          </div>
        </div>
      )}
    </>
  )
}