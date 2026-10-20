import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { quizApi, type ExamResult } from "../api/quiz"
import { downloadCertificate } from "../api/courses"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "../components/Button"
import { buttonClass } from "../components/buttonStyles"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

export default function ExamPage() {
  const { id } = useParams()
  const enrollmentId = Number(id)
  const validId = Number.isInteger(enrollmentId) && enrollmentId > 0
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<ExamResult | null>(null)
  const [downloading, setDownloading] = useState(false)

  const exam = useQuery({
    queryKey: ["exam", enrollmentId],
    queryFn: async () => (await quizApi.show(enrollmentId)).data.data,
    enabled: validId,
    retry: false,
  })

  const submit = useMutation({
    mutationFn: () => quizApi.submit(enrollmentId, answers),
    onSuccess: (res) => {
      setResult(res.data.data)
      void qc.invalidateQueries({ queryKey: ["exam", enrollmentId] })
      void qc.invalidateQueries({ queryKey: ["enrollment", enrollmentId] })
      void qc.invalidateQueries({ queryKey: ["my-enrollments"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  async function handleDownload(certificateId: number) {
    setDownloading(true)
    try {
      await downloadCertificate(certificateId)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  const backTo = `/etudiant/cours/${enrollmentId}`

  if (!validId) {
    return <EmptyState message={t("common.not_found")} actionTo="/etudiant" actionLabel={t("learn.back")} />
  }
  if (exam.isLoading) return <ListSkeleton rows={3} />
  if (exam.error || !exam.data) return <ErrorState error={exam.error} onRetry={() => void exam.refetch()} />

  const data = exam.data
  const card = "rounded-card border border-line bg-surface p-4 shadow-card"
  const allAnswered = data.questions.length > 0 && data.questions.every((q) => answers[q.id] !== undefined)

  let body
  if (result) {
    body = (
      <div className={card} role="status">
        <h2 className="text-lg font-bold">{result.passed ? t("exam.passed_title") : t("exam.failed_title")}</h2>
        <p className="mt-1 text-sm">
          {t("exam.score", { score: result.score, correct: result.correct, total: result.total })}
        </p>
        {!result.passed && (
          <p className="mt-1 text-sm text-muted">{t("exam.attempts_left", { n: result.attempts_left })}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {result.passed && result.certificate_id !== null && (
            <Button size="sm" loading={downloading} onClick={() => void handleDownload(result.certificate_id as number)}>
              {t("exam.download")}
            </Button>
          )}
          {!result.passed && result.attempts_left > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setResult(null)
                setAnswers({})
              }}
            >
              {t("exam.retry")}
            </Button>
          )}
          <Link to={backTo} className={buttonClass({ size: "sm", variant: "secondary" })}>
            {t("exam.back_course")}
          </Link>
        </div>
      </div>
    )
  } else if (data.passed) {
    body = (
      <div className={card}>
        <p className="text-sm font-semibold">{t("exam.already_passed")}</p>
        <Link to={backTo} className={`${buttonClass({ size: "sm" })} mt-3`}>{t("exam.back_course")}</Link>
      </div>
    )
  } else if (!data.video_done) {
    body = <div className={card}><p className="text-sm">{t("exam.locked")}</p></div>
  } else if (data.attempts_used >= data.max_attempts) {
    body = <div className={card}><p className="text-sm">{t("exam.no_attempts")}</p></div>
  } else {
    body = (
      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <fieldset key={q.id} className={card}>
            <legend className="px-1 text-xs font-semibold uppercase text-muted">
              {t("exam.question_n", { n: i + 1 })}
            </legend>
            <p className="mb-3 font-medium">{q.prompt}</p>
            <div className="space-y-2">
              {q.options.map((opt, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    className="mt-1"
                    checked={answers[q.id] === j}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {!allAnswered && <p className="text-xs text-muted">{t("exam.answer_all")}</p>}
        <Button disabled={!allAnswered} loading={submit.isPending} onClick={() => submit.mutate()}>
          {t("exam.submit")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={backTo} className="text-sm font-semibold text-primary">← {t("exam.back_course")}</Link>
      <h1 className="mb-1 mt-2 text-xl font-bold tracking-tight sm:text-2xl">{data.title || t("exam.title")}</h1>
      <p className="mb-4 text-sm text-muted">
        {t("exam.intro", { score: data.passing_score, used: data.attempts_used, max: data.max_attempts })}
      </p>
      {body}
    </div>
  )
}