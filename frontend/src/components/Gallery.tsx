import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type TouchEvent } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react"
import ProductImage from "./ProductImage"

interface Props {
  images: string[]
  thumbs?: string[] // miniatures (même ordre que images) pour la bande de vignettes
  alt: string
  ratio?: string
  footer?: ReactNode // affiché dans le plein écran (ex : prix + ajouter au panier)
}

function useSwipe(onPrev: () => void, onNext: () => void) {
  const x = useRef<number | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => { x.current = e.touches.length === 1 ? e.touches[0].clientX : null },
    onTouchEnd: (e: TouchEvent) => {
      if (x.current === null) return
      const dx = e.changedTouches[0].clientX - x.current
      x.current = null
      if (Math.abs(dx) > 50) (dx < 0 ? onNext : onPrev)()
    },
  }
}

const arrow =
  "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:scale-105 active:scale-95"

export default function Gallery({ images, thumbs, alt, ratio = "aspect-[4/3] sm:aspect-video", footer }: Props) {
  const { t } = useTranslation()
  const list = images.filter(Boolean)
  const n = list.length
  const small = thumbs && thumbs.length === n ? thumbs : list
  const [cur, setCur] = useState(0)
  const [open, setOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [hover, setHover] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")
  const idx = Math.min(cur, Math.max(n - 1, 0))
  const strip = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const select = useCallback((i: number) => { setCur(i); setZoomed(false) }, [])
  const go = useCallback((d: number) => {
    setZoomed(false)
    setCur((c) => (n ? (Math.min(c, n - 1) + d + n) % n : 0))
  }, [n])
  const swipe = useSwipe(() => go(-1), () => go(1))

  function openViewer() {
    opener.current = document.activeElement as HTMLElement | null
    setZoomed(false)
    setHover(false)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
      else if (e.key === "Tab" && dialog.current) {
        const f = Array.from(dialog.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"))
        if (f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.querySelector<HTMLElement>("[data-close]")?.focus()
    const back = opener.current
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      back?.focus?.()
    }
  }, [open, go])

  useEffect(() => {
    const el = strip.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [idx])

  if (n === 0) {
    return <ProductImage src={null} alt={alt} ratio={ratio} className="rounded-card shadow-card" />
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    setHover(true)
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }

  const thumbRow = (size: string, dark: boolean, ref?: React.Ref<HTMLDivElement>) => (
    <div ref={ref} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {small.map((src, i) => (
        <button
          key={`${src}-${i}`}
          type="button"
          onClick={() => select(i)}
          aria-label={`${alt} ${i + 1}`}
          aria-current={i === idx}
          className={`${size} flex-none overflow-hidden rounded-lg border-2 transition ${
            i === idx ? "border-primary" : dark ? "border-white/20 opacity-70 hover:opacity-100" : "border-line opacity-80 hover:opacity-100"
          }`}
        >
          <ProductImage src={src} alt="" ratio="aspect-square" compact />
        </button>
      ))}
    </div>
  )

  return (
    <div data-tour="pd-gallery">
      <div className="relative overflow-hidden rounded-card bg-page shadow-card" {...swipe}>
        <div
          className="cursor-zoom-in overflow-hidden"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(false)}
        >
          <button type="button" onClick={openViewer} aria-label={t("ux.zoom")} className="block w-full">
            <div className="transition-transform duration-200 ease-out" style={{ transform: hover ? "scale(1.8)" : "scale(1)", transformOrigin: origin }}>
              <ProductImage key={list[idx]} src={list[idx]} alt={idx === 0 ? alt : `${alt} ${idx + 1}`} ratio={ratio} priority />
            </div>
          </button>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm">
          <Maximize2 className="h-4 w-4" />
        </span>
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("ux.prev_image", { defaultValue: "Image précédente" })} className={`${arrow} left-2 hidden sm:flex`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("ux.next_image", { defaultValue: "Image suivante" })} className={`${arrow} right-2 hidden sm:flex`}>
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-medium text-white">
              {idx + 1} / {n}
            </span>
          </>
        )}
      </div>

      {n > 1 && <div className="mt-3">{thumbRow("h-16 w-16 sm:h-20 sm:w-20", false, strip)}</div>}

      {open && (
        <div ref={dialog} className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={alt}>
          <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
            <span className="text-sm font-medium">{idx + 1} / {n}</span>
            <button
              type="button"
              data-close
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className={`relative flex min-h-0 flex-1 ${zoomed ? "overflow-auto [touch-action:pan-x_pan-y_pinch-zoom]" : "items-center justify-center px-2 [touch-action:pan-y_pinch-zoom]"}`}
            {...(zoomed ? {} : swipe)}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          >
            <img
              src={list[idx]}
              alt={`${alt} ${idx + 1}`}
              draggable={false}
              onClick={() => setZoomed((z) => !z)}
              className={`select-none ${zoomed ? "m-auto w-[250%] max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}`}
            />
            {n > 1 && !zoomed && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t("ux.prev_image", { defaultValue: "Image précédente" })} className={`${arrow} left-3`}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t("ux.next_image", { defaultValue: "Image suivante" })} className={`${arrow} right-3`}>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {n > 1 && <div className="px-4 pt-2">{thumbRow("h-14 w-14", true)}</div>}

          {footer ? (
            <div className="mt-2 border-t border-line bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <div className="mx-auto max-w-6xl">{footer}</div>
            </div>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </div>
      )}
    </div>
  )
}