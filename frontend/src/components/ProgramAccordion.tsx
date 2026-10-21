import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import RichText from "./RichText"

interface Section { title: string; body: string }

/** Chaque ligne "## Titre" ouvre un module ; le texte avant le premier titre est une introduction. */
function split(src: string): { intro: string; sections: Section[] } {
  const sections: Section[] = []
  const intro: string[] = []
  let cur: { title: string; body: string[] } | null = null
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const h = /^#{1,3}\s+(.*)$/.exec(raw.trim())
    if (h) {
      if (cur) sections.push({ title: cur.title, body: cur.body.join("\n") })
      cur = { title: h[1], body: [] }
    } else if (cur) cur.body.push(raw)
    else intro.push(raw)
  }
  if (cur) sections.push({ title: cur.title, body: cur.body.join("\n") })
  return { intro: intro.join("\n").trim(), sections }
}

export default function ProgramAccordion({ text }: { text: string }) {
  const { t } = useTranslation()
  const { intro, sections } = useMemo(() => split(text), [text])
  const [open, setOpen] = useState<Set<number>>(new Set([0]))

  if (sections.length === 0) return <RichText text={text} />

  const all = open.size === sections.length
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
    <div className="space-y-3">
      {intro && <RichText text={intro} />}
      {sections.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(all ? new Set() : new Set(sections.map((_, i) => i)))}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {all ? t("px.faq.collapse", { defaultValue: "Tout replier" }) : t("px.faq.expand", { defaultValue: "Tout déplier" })}
          </button>
        </div>
      )}
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {sections.map((s, i) => {
          const isOpen = open.has(i)
          return (
            <li key={i}>
              <button
                type="button" aria-expanded={isOpen} onClick={() => toggle(i)}
                className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-page/60"
              >
                <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold sm:text-[15px]">{s.title}</span>
                <ChevronDown aria-hidden="true" className={`h-5 w-5 flex-none text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="px-3.5 pb-4 pl-[3.25rem] text-sm"><RichText text={s.body} /></div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}