import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import axios from "axios"
import { quizApi } from "../api/quiz"
import { getErrorMessage } from "../lib/errors"

export default function VerifyCertificatePage() {
  const { code } = useParams()
  const { t, i18n } = useTranslation()

  const check = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: async () => (await quizApi.verify(code as string)).data.data,
    enabled: !!code,
    retry: false,
  })

  const revoked = !!(check.data as { revoked?: boolean } | undefined)?.revoked
  const notFound = axios.isAxiosError(check.error) && check.error.response?.status === 404
  const card = "mx-auto mt-6 max-w-md rounded-card border border-line bg-surface p-6 shadow-card"

  return (
    <div className="px-4 py-8">
      <h1 className="text-center text-xl font-bold tracking-tight sm:text-2xl">{t("verify.title")}</h1>

      {check.isLoading && <p className="mt-6 text-center text-sm text-muted" role="status">{t("verify.checking")}</p>}

      {check.data && !revoked && (
        <div className={card} role="status">
          <p className="text-lg font-bold text-primary">✓ {t("verify.valid")}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">{t("verify.holder")}</dt><dd className="font-semibold">{check.data.holder}</dd></div>
            <div><dt className="text-muted">{t("verify.course")}</dt><dd className="font-semibold">{check.data.course}</dd></div>
            <div>
              <dt className="text-muted">{t("verify.issued")}</dt>
              <dd className="font-semibold">
                {check.data.issued_at ? new Date(check.data.issued_at).toLocaleDateString(i18n.language) : "—"}
              </dd>
            </div>
            <div><dt className="text-muted">{t("verify.code")}</dt><dd className="font-mono font-semibold">{check.data.code}</dd></div>
          </dl>
        </div>
      )}

      {revoked && (
        <div className={card} role="alert">
          <p className="font-semibold text-danger">{i18n.language.startsWith("en") ? "This certificate has been revoked." : "Ce certificat a été révoqué."}</p>
          <p className="mt-1 font-mono text-sm text-muted">{code}</p>
        </div>
      )}

      {notFound && (
        <div className={card} role="alert">
          <p className="font-semibold">{t("verify.invalid")}</p>
          <p className="mt-1 font-mono text-sm text-muted">{code}</p>
        </div>
      )}

      {check.error && !notFound && (
        <div className={card} role="alert">
          <p className="text-sm">{getErrorMessage(check.error)}</p>
          <button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={() => void check.refetch()}>
            {t("verify.retry")}
          </button>
        </div>
      )}

      <p className="mt-6 text-center"><Link to="/" className="text-sm font-semibold text-primary">{t("common.back_home")}</Link></p>
    </div>
  )
}