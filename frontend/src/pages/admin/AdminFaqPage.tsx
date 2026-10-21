import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { faqApi, type Faq, type FaqInput, type FaqSpace } from "../../api/faq"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const inputClass =
  "mt-1 min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const btnGhost =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const btnDanger =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold text-danger transition hover:bg-danger/5 active:scale-95 disabled:opacity-50"
const btnMini =
  "grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-sm transition hover:bg-black/5 active:scale-95 disabled:opacity-30"

const empty: FaqInput = {
  question_fr: "", answer_fr: "", question_en: "", answer_en: "", category_fr: "", category_en: "", is_published: true,
}

function Txt(props: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  rows?: number
  list?: string
  max?: number
}) {
  const { label, value, onChange, error, rows, list, max } = props
  return (
    <label className="block text-sm font-medium">
      {label}
      {rows ? (
        <textarea rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input list={list} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

export default function AdminFaqPage({ space }: { space: FaqSpace }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<number | "new" | null>(null)
  const [form, setForm] = useState<FaqInput>(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const list = useQuery({
    queryKey: ["admin-faqs", space],
    queryFn: async () => (await faqApi.adminList(space)).data.data,
  })
  const items: Faq[] = list.data ?? []

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-faqs"] })
    void qc.invalidateQueries({ queryKey: ["faqs"] })
  }

  const save = useMutation({
    mutationFn: (v: { id: number | null; data: FaqInput }) =>
      v.id === null ? faqApi.create(space, v.data) : faqApi.update(space, v.id, v.data),
    onSuccess: () => {
      toast.success("Question enregistrée.")
      setEditing(null)
      refresh()
    },
    onError: (e) => {
      const f = getFieldErrors(e)
      setErrors(f)
      if (Object.keys(f).length === 0) toast.error(getErrorMessage(e))
    },
  })

  const toggle = useMutation({
    mutationFn: (f: Faq) => faqApi.update(space, f.id, { is_published: !f.is_published }),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => faqApi.remove(space, id),
    onSuccess: () => {
      toast.success("Question supprimée.")
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const reorder = useMutation({
    mutationFn: (ids: number[]) => faqApi.reorder(space, ids),
    onSuccess: refresh,
    onError: (e) => {
      toast.error(getErrorMessage(e))
      refresh()
    },
  })

  const set = (k: keyof FaqInput) => (v: string) => setForm((s) => ({ ...s, [k]: v }))

  function openNew() {
    setForm(empty)
    setErrors({})
    setEditing("new")
  }

  function openEdit(f: Faq) {
    setForm({
      question_fr: f.question_fr,
      answer_fr: f.answer_fr,
      question_en: f.question_en ?? "",
      answer_en: f.answer_en ?? "",
      category_fr: f.category_fr ?? "",
      category_en: f.category_en ?? "",
      is_published: f.is_published,
    })
    setErrors({})
    setEditing(f.id)
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    const ids = items.map((x) => x.id)
    const tmp = ids[index]
    ids[index] = ids[j]
    ids[j] = tmp
    reorder.mutate(ids)
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (form.question_fr.trim().length < 3) local.question_fr = "La question en français est obligatoire."
    if (form.answer_fr.trim().length < 3) local.answer_fr = "La réponse en français est obligatoire."
    const hasEn = form.question_en.trim() !== "" || form.answer_en.trim() !== ""
    if (hasEn && (form.question_en.trim() === "" || form.answer_en.trim() === "")) {
      local.question_en = "Renseignez la question ET la réponse en anglais, ou laissez les deux vides."
    }
    setErrors(local)
    if (Object.keys(local).length > 0) return
    save.mutate({ id: editing === "new" || editing === null ? null : editing, data: form })
  }

  const categories = Array.from(
    new Set(items.flatMap((x) => [x.category_fr, x.category_en]).filter((c): c is string => Boolean(c))),
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">FAQ</h1>
          <p className="text-sm text-muted">
            Questions fréquentes affichées sur la page publique {space === "shop" ? "/faq" : "/formations/faq"}. L'ordre ci-dessous est celui du site.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={space === "shop" ? "/faq" : "/formations/faq"} target="_blank" rel="noopener noreferrer" className={`${btnGhost} inline-flex items-center`}>Voir la page</a>
          <button type="button" onClick={openNew} className={btnPrimary}>Ajouter une question</button>
        </div>
      </div>

      {editing !== null && (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-base font-bold">{editing === "new" ? "Nouvelle question" : "Modifier la question"}</h2>
          <datalist id="faq-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Français (obligatoire)</h3>
              <Txt label="Catégorie (facultatif)" value={form.category_fr} onChange={set("category_fr")} error={errors.category_fr} list="faq-categories" max={80} />
              <Txt label="Question" value={form.question_fr} onChange={set("question_fr")} error={errors.question_fr} max={255} />
              <Txt label="Réponse" rows={6} value={form.answer_fr} onChange={set("answer_fr")} error={errors.answer_fr} max={5000} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">English (optionnel)</h3>
              <Txt label="Category" value={form.category_en} onChange={set("category_en")} error={errors.category_en} list="faq-categories" max={80} />
              <Txt label="Question" value={form.question_en} onChange={set("question_en")} error={errors.question_en} max={255} />
              <Txt label="Answer" rows={6} value={form.answer_en} onChange={set("answer_en")} error={errors.answer_en} max={5000} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox" checked={form.is_published}
              onChange={(e) => setForm((s) => ({ ...s, is_published: e.target.checked }))}
              className="h-4 w-4"
            />
            Publiée (visible sur la page publique)
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={save.isPending} className={btnPrimary}>
              {save.isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Annuler</button>
          </div>
        </form>
      )}

      {list.isLoading && <p className="text-sm text-muted">Chargement...</p>}
      {list.isError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(list.error)}</p>
      )}
      {!list.isLoading && !list.isError && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Aucune question pour le moment. Cliquez sur « Ajouter une question ».
        </p>
      )}

      <ul className="space-y-2">
        {items.map((f, i) => (
          <li key={f.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
            <div className="flex shrink-0 flex-col gap-1">
              <button type="button" aria-label="Monter" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className={btnMini}>↑</button>
              <button type="button" aria-label="Descendre" disabled={i === items.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className={btnMini}>↓</button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {f.category_fr && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{f.category_fr}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${f.is_published ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                  {f.is_published ? "Publiée" : "Masquée"}
                </span>
                {!f.question_en && <span className="text-[11px] text-muted">Pas de version anglaise</span>}
              </div>
              <p className="mt-1 font-semibold">{f.question_fr}</p>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted">{f.answer_fr}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <button type="button" onClick={() => openEdit(f)} className={btnGhost}>Modifier</button>
              <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(f)} className={btnGhost}>
                {f.is_published ? "Masquer" : "Publier"}
              </button>
              <button
                type="button" disabled={remove.isPending} className={btnDanger}
                onClick={() => { if (window.confirm("Supprimer cette question définitivement ?")) remove.mutate(f.id) }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}