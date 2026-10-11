import { useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import ProductImage from "./ProductImage"

interface Props {
  images: string[]
  alt: string
  to?: string
  ratio?: string
  imgClassName?: string
  fit?: "cover" | "contain"
  children?: ReactNode
}

const arrow =
  "absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-md transition hover:scale-105 active:scale-95 group-hover:opacity-100 sm:flex opacity-0 focus-visible:opacity-100"

export default function ImageCarousel({ images, alt, to, ratio = "aspect-[4/5]", imgClassName = "", fit, children }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const list: (string | null)[] = images.length > 0 ? images : [null]
  const multiple = list.length > 1

  function go(delta: number) {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: (index + delta) * el.clientWidth, behavior: "smooth" })
  }

  function onScroll() {
    const el = ref.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="relative overflow-hidden">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {list.map((src, i) => {
          const image = <ProductImage src={src} alt={i === 0 ? alt : `${alt} ${i + 1}`} ratio={ratio} imgClassName={imgClassName} fit={fit} />
          return (
            <div key={`${src}-${i}`} className="w-full flex-none snap-center">
              {to ? <Link to={to} tabIndex={i === index ? 0 : -1}>{image}</Link> : image}
            </div>
          )
        })}
      </div>

      {children}

      {multiple && (
        <>
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {index + 1}/{list.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {list.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} aria-label={t("ux.prev_image", { defaultValue: "Image précédente" })} className={`${arrow} left-2`}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {index < list.length - 1 && (
            <button type="button" onClick={() => go(1)} aria-label={t("ux.next_image", { defaultValue: "Image suivante" })} className={`${arrow} right-2`}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  )
}