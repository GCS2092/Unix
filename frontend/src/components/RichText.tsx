import { Fragment, useMemo, type ReactNode } from "react"

type Block =
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }

/** Syntaxe simple : "## Titre", "- puce", "1. étape", "**gras**", ligne vide = nouveau paragraphe. */
function parse(src: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  let list = null as { ordered: boolean; items: string[] } | null
  const flushP = () => { if (para.length) { out.push({ type: "p", text: para.join("\n") }); para = [] } }
  const flushL = () => { if (list) { out.push({ type: list.ordered ? "ol" : "ul", items: list.items }); list = null } }

  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trim()
    if (!line) { flushP(); flushL(); continue }
    const h = /^#{1,3}\s+(.*)$/.exec(line)
    if (h) { flushP(); flushL(); out.push({ type: "h", text: h[1] }); continue }
    const b = /^[-•*]\s+(.*)$/.exec(line)
    const o = /^\d+[.)]\s+(.*)$/.exec(line)
    if (b || o) {
      flushP()
      const ordered = !!o
      if (list && list.ordered !== ordered) flushL()
      if (!list) list = { ordered, items: [] }
      list.items.push((b ?? o)![1])
      continue
    }
    flushL()
    para.push(line)
  }
  flushP()
  flushL()
  return out
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  )
}

export default function RichText({ text, className = "" }: { text?: string | null; className?: string }) {
  const blocks = useMemo(() => parse(text ?? ""), [text])
  if (blocks.length === 0) return null
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "h") return <h3 key={i} className="pt-3 text-lg font-bold text-ink first:pt-0">{inline(b.text)}</h3>
        if (b.type === "p") return <p key={i} className="whitespace-pre-line leading-relaxed text-muted">{inline(b.text)}</p>
        if (b.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5 leading-relaxed text-muted marker:font-semibold marker:text-primary">
              {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
            </ol>
          )
        }
        return (
          <ul key={i} className="space-y-2">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5 leading-relaxed text-muted">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                <span>{inline(it)}</span>
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}