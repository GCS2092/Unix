import { useState } from "react"

interface Props {
  src?: string | null
  alt: string
  ratio?: string
  className?: string
  imgClassName?: string
  priority?: boolean
}

export default function ProductImage({ src, alt, ratio = "aspect-square", className = "", imgClassName = "", priority = false }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showImage = !!src && !failed

  return (
    <div className={`relative w-full overflow-hidden bg-page ${ratio} ${className}`}>
      {showImage ? (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-line/60" />}
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted">Pas d'image</div>
      )}
    </div>
  )
}