import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { certificatesAdminApi } from "../api/certificatesAdmin"
import { getErrorMessage } from "../lib/errors"
import { saveBlob } from "../lib/download"
import { toast } from "../stores/toastStore"

const CHUNK = 5

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "certificat"

/** Telechargement (PDF ou ZIP) et envoi par e-mail des certificats, avec confirmation et messages. */
export function useCertificateActions() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<"send" | "file" | null>(null)

  const refresh = () => {
    for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments"]) {
      void qc.invalidateQueries({ queryKey: [k] })
    }
  }

  async function send(ids: number[], email: string | null) {
    if (busy || ids.length === 0) return
    const target = email ?? t("fx.cert.account_email", { defaultValue: "l'adresse du compte" })
    if (!window.confirm(t("fx.cert.confirm_send", { defaultValue: "Envoyer {{n}} certificat(s) par e-mail à {{email}} ?", n: ids.length, email: target }))) return

    setBusy("send")
    let sent = 0
    let failed = 0
    let skipped = 0
    const problems: string[] = []
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = (await certificatesAdminApi.send(ids.slice(i, i + CHUNK))).data.data
        sent += res.sent
        failed += res.failed
        skipped += res.skipped
        for (const r of res.results) {
          if (r.status !== "sent" && r.message && problems.length < 3) problems.push(r.message)
        }
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(null)
      refresh()
    }
    if (sent > 0) toast.success(t("fx.cert.sent", { defaultValue: "{{n}} certificat(s) envoyé(s).", n: sent }))
    if (failed > 0 || skipped > 0) {
      toast.error(`${t("fx.cert.send_failed", { defaultValue: "{{n}} non envoyé(s)", n: failed + skipped })} ${problems.join(" | ")}`)
    }
  }

  async function download(ids: number[], baseName: string) {
    if (busy || ids.length === 0) return
    setBusy("file")
    try {
      const res = await certificatesAdminApi.files(ids)
      const zip = res.data.type.includes("zip")
      saveBlob(res.data, zip ? `certificats-${new Date().toISOString().slice(0, 10)}.zip` : `certificat-${slug(baseName)}.pdf`)
      refresh()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return { busy, send, download }
}