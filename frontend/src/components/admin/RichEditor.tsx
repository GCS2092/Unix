import { useRef, useState, type KeyboardEvent } from "react"
import RichText from "../RichText"

interface Props {
  label?: string
  value: string
  onChange: (v: string) => void
  rows?: number
  max?: number
  error?: string
  hint?: string
  placeholder?: string
}

const tool =
  "inline-flex h-9 min-w-[36px] items-center justify-center rounded-md px-2 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-40"

/** Zone de texte avec barre d'outils (titre, puces, liste numérotée, gras) et aperçu : écrit la syntaxe lue par RichText. */
export default function RichEditor({ label, value, onChange, rows = 6, max, error, hint, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  function apply(next: string, from: number, to: number) {
    onChange(max ? next.slice(0, max) : next)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(from, to)
    })
  }

  function bold() {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const sel = value.slice(s, e) || "texte"
    apply(value.slice(0, s) + "**" + sel + "**" + value.slice(e), s + 2, s + 2 + sel.length)
  }

  function lines(kind: "h" | "ul" | "ol") {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const start = s === 0 ? 0 : value.lastIndexOf("\n", s - 1) + 1
    let end = value.indexOf("\n", e)
    if (end === -1) end = value.length
    const block = value.slice(start, end).split("\n")
    const content = block.filter((l) => l.trim() !== "")

    if (content.length === 0) {
      const ins = kind === "h" ? "## Titre" : kind === "ul" ? "- Élément" : "1. Élément"
      const offset = kind === "ul" ? 2 : 3
      apply(value.slice(0, start) + ins + value.slice(end), start + offset, start + ins.length)
      return
    }

    const re = kind === "h" ? /^#{1,3}\s+/ : kind === "ul" ? /^[-•*]\s+/ : /^\d+[.)]\s+/
    const allOn = content.every((l) => re.test(l))
    let n = 0
    const text = block
      .map((l) => {
        if (l.trim() === "") return l
        const bare = l.replace(/^(#{1,3}|[-•*]|\d+[.)])\s+/, "")
        if (allOn) return bare
        n++
        return (kind === "h" ? "## " : kind === "ul" ? "- " : `${n}. `) + bare
      })
      .join("\n")
    apply(value.slice(0, start) + text + value.slice(end), start, start + text.length)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault()
      bold()
    }
  }

  const tab = (on: boolean) =>
    `min-h-[32px] rounded-md px-3 transition ${on ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`

  return (
    <div className="text-sm font-medium">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{label}</span>
        <div className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-semibold">
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} className={tab(!preview)}>Écrire</button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)} className={tab(preview)}>Aperçu</button>
        </div>
      </div>

      <div className="mt-1 overflow-hidden rounded-lg border border-line bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap gap-0.5 border-b border-line bg-page/60 p-1">
          <button type="button" disabled={preview} onClick={() => lines("h")} title="Titre" aria-label="Titre" className={tool}>H</button>
          <button type="button" disabled={preview} onClick={() => lines("ul")} title="Liste à puces" aria-label="Liste à puces" className={tool}>• Liste</button>
          <button type="button" disabled={preview} onClick={() => lines("ol")} title="Liste numérotée" aria-label="Liste numérotée" className={tool}>1. Liste</button>
          <button type="button" disabled={preview} onClick={bold} title="Gras (Ctrl+B)" aria-label="Gras" className={`${tool} font-extrabold`}>B</button>
        </div>
        {preview ? (
          <div className="min-h-[8rem] p-3 text-sm font-normal">
            {value.trim() ? <RichText text={value} /> : <p className="text-muted">Rien à afficher pour le moment.</p>}
          </div>
        ) : (
          <textarea
            ref={ref}
            rows={rows}
            maxLength={max}
            value={value}
            placeholder={placeholder}
            aria-label={label}
            onKeyDown={onKeyDown}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full resize-y bg-transparent px-3 py-2 text-sm font-normal outline-none"
          />
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-start justify-between gap-2 text-xs font-normal text-muted">
        <span>{hint ?? "Sélectionnez du texte puis cliquez sur un bouton. Ctrl+B pour le gras."}</span>
        {max ? <span>{value.length}/{max}</span> : null}
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  )
}