interface Props { urls: string[]; kind: "shop" | "formation" | string }

const ICON: Record<string, string> = {
  shop: "M6 2l-3 4v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  formation: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 21h15",
}

/** Visuel d'une carte : 1 à 4 vraies images, sinon un dégradé avec une icône. */
export default function Mosaic({ urls, kind }: Props) {
  const list = urls.filter(Boolean).slice(0, 4)

  if (list.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-primary to-primary-dark text-white/80" aria-hidden="true">
        <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON[kind] ?? ICON.shop} />
        </svg>
      </div>
    )
  }
  if (list.length === 1) return <img src={list[0]} alt="" loading="lazy" className="h-48 w-full object-cover" />

  const cols = list.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"
  return (
    <div className={`grid h-48 w-full gap-0.5 overflow-hidden bg-line ${cols}`}>
      {list.map((u, i) => (
        <img
          key={`${u}-${i}`} src={u} alt="" loading="lazy"
          className={`h-full w-full object-cover ${list.length === 3 && i === 0 ? "row-span-2" : ""}`}
        />
      ))}
    </div>
  )
}