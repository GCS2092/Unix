import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminQuizApi, type AdminQuiz } from "../../api/quiz"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import { Switch } from "../../components/admin/ui"

interface FormQuestion {
  prompt: string
  options: string[]
  correct_index: number
}

interface FormState {
  title: string
  passing_score: number
  max_attempts: number
  is_published: boolean
  questions: FormQuestion[]
}

const blankQuestion = (): FormQuestion => ({ prompt: "", options: ["", ""], correct_index: 0 })
const blankForm = (): FormState => ({
  title: "",
  passing_score: 70,
  max_attempts: 3,
  is_published: false,
  questions: [blankQuestion()],
})

function fromApi(q: AdminQuiz): FormState {
  return {
    title: q.title ?? "",
    passing_score: q.passing_score,
    max_attempts: q.max_attempts,
    is_published: q.is_published,
    questions: q.questions.map((x) => ({ prompt: x.prompt, options: [...x.options], correct_index: x.correct_index })),
  }
}

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"

export default function AdminQuizPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(blankForm)

  const quiz = useQuery({
    queryKey: ["admin-quiz", slug],
    queryFn: async () => (await adminQuizApi.get(slug as string)).data.data,
    enabled: !!slug,
  })

  useEffect(() => {
    if (quiz.isSuccess) setForm(quiz.data ? fromApi(quiz.data) : blankForm())
  }, [quiz.isSuccess, quiz.data])

  const save = useMutation({
    mutationFn: () =>
      adminQuizApi.save(slug as string, {
        title: form.title.trim() || null,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
        is_published: form.is_published,
        questions: form.questions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correct_index: q.correct_index,
        })),
      }),
    onSuccess: (res) => {
      qc.setQueryData(["admin-quiz", slug], res.data.data)
      void qc.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success(t("exam.saved"))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function patchQuestion(i: number, patch: Partial<FormQuestion>) {
    setForm((f) => ({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) }))
  }

  function removeOption(i: number, j: number) {
    const q = form.questions[i]
    const correct = q.correct_index === j ? 0 : q.correct_index > j ? q.correct_index - 1 : q.correct_index
    patchQuestion(i, { options: q.options.filter((_, k) => k !== j), correct_index: correct })
  }

  function submit() {
    const numbersOk =
      form.passing_score >= 1 && form.passing_score <= 100 && form.max_attempts >= 1 && form.max_attempts <= 20
    if (!numbersOk) return toast.error(t("exam.invalid_numbers"))
    const formOk = form.questions.every((q) => q.prompt.trim() !== "" && q.options.every((o) => o.trim() !== ""))
    if (!formOk || form.questions.length === 0) return toast.error(t("exam.invalid_form"))
    save.mutate()
  }

  if (quiz.isLoading) return <ListSkeleton rows={3} />
  if (quiz.error) return <ErrorState error={quiz.error} onRetry={() => void quiz.refetch()} />

  const card = "rounded-card border border-line bg-surface p-4 shadow-card"

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link to="/admin/formation/cours" className="text-sm font-semibold text-primary">← {t("exam.admin_back")}</Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{t("exam.admin_title")}</h1>
      </div>

      <div className={`${card} grid gap-3 sm:grid-cols-3`}>
        <label className="text-sm sm:col-span-3">
          <span className="mb-1 block font-semibold">{t("exam.exam_title_label")}</span>
          <input className={input} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{t("exam.passing_label")}</span>
          <input
            className={input}
            type="number"
            min={1}
            max={100}
            value={form.passing_score}
            onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{t("exam.attempts_label")}</span>
          <input
            className={input}
            type="number"
            min={1}
            max={20}
            value={form.max_attempts}
            onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) || 0 })}
          />
        </label>
        <div className="text-sm">
          <Switch
            checked={form.is_published}
            onChange={(v) => setForm({ ...form, is_published: v })}
            label={t("exam.published_label")}
          />
        </div>
        <p className="text-xs text-muted sm:col-span-3">{t("exam.published_hint")}</p>
      </div>

      {form.questions.map((q, i) => (
        <div key={i} className={card}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">{t("exam.question_n", { n: i + 1 })}</span>
            {form.questions.length > 1 && (
              <button
                type="button"
                className="text-xs font-semibold text-red-600"
                onClick={() => setForm({ ...form, questions: form.questions.filter((_, k) => k !== i) })}
              >
                {t("exam.remove_question")}
              </button>
            )}
          </div>
          <textarea
            className={input}
            rows={2}
            maxLength={1000}
            aria-label={t("exam.prompt_label")}
            placeholder={t("exam.prompt_label")}
            value={q.prompt}
            onChange={(e) => patchQuestion(i, { prompt: e.target.value })}
          />
          <div className="mt-3 space-y-2">
            {q.options.map((opt, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  aria-label={t("exam.correct")}
                  title={t("exam.correct")}
                  checked={q.correct_index === j}
                  onChange={() => patchQuestion(i, { correct_index: j })}
                />
                <input
                  className={input}
                  maxLength={300}
                  placeholder={t("exam.option_n", { n: j + 1 })}
                  value={opt}
                  onChange={(e) => patchQuestion(i, { options: q.options.map((o, k) => (k === j ? e.target.value : o)) })}
                />
                {q.options.length > 2 && (
                  <button type="button" className="px-2 text-lg leading-none text-muted" aria-label={t("exam.remove_option")} onClick={() => removeOption(i, j)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {q.options.length < 6 && (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-primary"
              onClick={() => patchQuestion(i, { options: [...q.options, ""] })}
            >
              + {t("exam.add_option")}
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {form.questions.length < 100 && (
          <Button variant="secondary" onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>
            + {t("exam.add_question")}
          </Button>
        )}
        <Button loading={save.isPending} onClick={submit}>{t("exam.save")}</Button>
      </div>
    </div>
  )
}