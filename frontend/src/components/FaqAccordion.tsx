import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { faqApi, type Faq, type FaqSpace } from "../api/faq"
import RichText from "./RichText"

interface Props {
  space: FaqSpace
  compact?: boolean // version courte pour les pages détail : pas de recherche, quelques questions, lien vers la FAQ complète
  limit?: number
  productId?: number // boutique : ajoute les questions rattachées à ce produit
  courseId?: number // formation : ajoute les questions rattachées à cette formation
}

const chip = (active: boolean) =>
  `min-h-[36px] flex-none whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary/50"
  }`

export default function FaqAccordion({ space, compact = false, limit = 5, productId, courseId }: Props) {
  const { t, i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("")
  const [open, setOpen] = useState<Set<number>>(new Set())

  const query = useQuery({
    queryKey: ["faqs", space, productId ?? 0, courseId ?? 0],
    queryFn: async () => (await faqApi.publicList(space, { product_id: productId, course_id: courseId })).data.data,
  })

  const general = t("px.faq.general", { defaultValue: "Général" })
  const items = useMemo(() => {
    const mapped = ((query.data ?? []) as Faq[]).map((f) => ({
      id: f.id,
      question: en && f.question_en ? f.question_en : f.question_fr,
      answer: en && f.answer_en ? f.answer_en : f.answer_fr,
      category: (en && f.category_en ? f.category_en : f.category_fr) || general,
      targeted: !!(f.product_id || f.course_id),
    }))
    // Les questions propres à ce produit / cette formation passent en premier
    return [...mapped].sort((a, b) => Number(b.targeted) - Number(a.targeted))
  }, [query.data, en, general])

  const categories = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1)
    return Array.from(m.entries())
  }, [items])

  const needle = q.trim().toLowerCase()
  let shown = items.filter(
    (i) => (!cat || i.category === cat) && (!needle || `${i.question} ${i.answer}`.toLowerCase().includes(needle)),
  )
  if (compact) {
    const nTarget = items.filter((i) => i.targeted).length
    shown = shown.slice(0, Math.max(limit, nTarget))
  }

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (compact && !query.isLoading && items.length === 0) return null

  const allOpen = shown.length > 0 && shown.every((i) => open.has(i.id) || needle !== "")

  return (
    <section className="space-y-4" aria-label="FAQ">
      {compact && (
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold">{t("px.faq.short_title", { defaultValue: "Questions fréquentes" })}</h2>
          <Link to={space === "shop" ? "/faq" : "/formations/faq"} className="text-sm font-semibold text-primary hover:underline">
            {t("px.faq.see_all", { defaultValue: "Toutes les questions" })}
          </Link>
        </div>
      )}

      {!compact && (
        <>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("px.faq.search", { defaultValue: "Rechercher une question..." })}
            aria-label={t("px.faq.search", { defaultValue: "Rechercher une question..." })}
            className="min-h-[48px] w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {categories.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group">
              <button type="button" aria-pressed={cat === ""} onClick={() => setCat("")} className={chip(cat === "")}>
                {t("px.faq.all", { defaultValue: "Toutes" })} ({items.length})
              </button>
              {categories.map(([c, count]) => (
                <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={chip(cat === c)}>
                  {c} ({count})
                </button>
              ))}
            </div>
          )}
          {shown.length > 1 && needle === "" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((i) => i.id)))}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {allOpen ? t("px.faq.collapse", { defaultValue: "Tout replier" }) : t("px.faq.expand", { defaultValue: "Tout déplier" })}
              </button>
            </div>
          )}
        </>
      )}

      {query.isLoading && <p className="text-center text-sm text-muted">{t("px.faq.loading", { defaultValue: "Chargement..." })}</p>}
      {query.isError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">
          {t("px.faq.error", { defaultValue: "Impossible de charger la FAQ pour le moment." })}
        </p>
      )}
      {!query.isLoading && !query.isError && shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {needle
            ? t("px.faq.none_found", { defaultValue: "Aucune question ne correspond à votre recherche." })
            : t("px.faq.none", { defaultValue: "Aucune question pour le moment." })}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {shown.map((r) => {
            const isOpen = needle !== "" || open.has(r.id)
            return (
              <li key={r.id}>
                <button
                  type="button" aria-expanded={isOpen} onClick={() => toggle(r.id)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-page/60"
                >
                  <span className="min-w-0">
                    {!compact && !cat && categories.length > 1 && (
                      <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-primary/80">{r.category}</span>
                    )}
                    <span className="block text-sm font-semibold sm:text-[15px]">{r.question}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`h-5 w-5 flex-none text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 text-sm"><RichText text={r.answer} /></div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}