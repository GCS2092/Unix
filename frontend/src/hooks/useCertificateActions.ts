import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { certificatesAdminApi } from "../api/certificatesAdmin"
import { getErrorMessage } from "../lib/errors"
import { saveBlob } from "../lib/download"
import { toast } from "../stores/toastStore"

const SEND_CHUNK = 5
const ISSUE_CHUNK = 10
const FILE_CHUNK = 20

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "certificat"

type Busy = "send" | "file" | "issue" | null

/** Emission, telechargement (PDF ou ZIP) et envoi par e-mail des certificats, avec confirmation, progression et messages. */
export function useCertificateActions() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<Busy>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const refresh = () => {
    for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments", "cert-emailed"]) {
      void qc.invalidateQueries({ queryKey: [k] })
    }
  }

  async function send(ids: number[], email: string | null): Promise<void> {
    if (busy || ids.length === 0) return
    const target = email ?? t("fx.cert.each_email", { defaultValue: "l'adresse de chaque élève" })
    if (!window.confirm(t("fx.cert.confirm_send", { defaultValue: "Envoyer {{n}} certificat(s) par e-mail à {{email}} ?", n: ids.length, email: target }))) return

    setBusy("send")
    setProgress({ done: 0, total: ids.length })
    let sent = 0
    let failed = 0
    let skipped = 0
    const problems: string[] = []
    try {
      for (let i = 0; i < ids.length; i += SEND_CHUNK) {
        const res = (await certificatesAdminApi.send(ids.slice(i, i + SEND_CHUNK))).data.data
        sent += res.sent
        failed += res.failed
        skipped += res.skipped
        for (const r of res.results) {
          if (r.status !== "sent" && r.message && problems.length < 3) problems.push(r.message)
        }
        setProgress({ done: Math.min(i + SEND_CHUNK, ids.length), total: ids.length })
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(null)
      setProgress(null)
      refresh()
    }
    if (sent > 0) toast.success(t("fx.cert.sent", { defaultValue: "{{n}} certificat(s) envoyé(s).", n: sent }))
    if (failed > 0 || skipped > 0) {
      toast.error(`${t("fx.cert.send_failed", { defaultValue: "{{n}} non envoyé(s)", n: failed + skipped })} ${problems.join(" | ")}`)
    }
  }

  async function issue(ids: number[]): Promise<void> {
    if (busy || ids.length === 0) return
    if (!window.confirm(t("fx.cert.confirm_all", { defaultValue: "Émettre {{n}} certificats ?", n: ids.length }))) return

    setBusy("issue")
    setProgress({ done: 0, total: ids.length })
    let issued = 0
    let failed = 0
    const problems: string[] = []
    try {
      for (let i = 0; i < ids.length; i += ISSUE_CHUNK) {
        const res = (await certificatesAdminApi.issueBatch(ids.slice(i, i + ISSUE_CHUNK))).data.data
        issued += res.issued
        failed += res.failed
        for (const r of res.results) {
          if (r.status === "failed" && problems.length < 3) problems.push(`#${r.id} : ${r.message ?? ""}`)
        }
        setProgress({ done: Math.min(i + ISSUE_CHUNK, ids.length), total: ids.length })
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(null)
      setProgress(null)
      refresh()
    }
    if (issued > 0) toast.success(t("fx.cert.done", { defaultValue: "{{n}} certificat(s) émis.", n: issued }))
    if (failed > 0) toast.error(`${t("fx.cert.failed", { defaultValue: "{{n}} échec(s)", n: failed })} ${problems.join(" | ")}`)
  }

  async function blobMessage(err: unknown): Promise<string> {
    const body = (err as { response?: { data?: unknown } })?.response?.data
    if (body instanceof Blob) {
      try {
        const m = (JSON.parse(await body.text()) as { message?: string }).message
        if (m) return m
      } catch { /* corps non JSON */ }
    }
    return getErrorMessage(err)
  }

  /** Emet les certificats manquants puis telecharge (PDF seul ou ZIP, par lots de 20). */
  async function download(ids: number[], baseName: string): Promise<void> {
    if (busy || ids.length === 0) return
    setBusy("file")
    setProgress(ids.length > FILE_CHUNK ? { done: 0, total: ids.length } : null)
    try {
      for (let i = 0; i < ids.length; i += FILE_CHUNK) {
        const res = await certificatesAdminApi.files(ids.slice(i, i + FILE_CHUNK))
        const zip = res.data.type.includes("zip")
        const part = ids.length > FILE_CHUNK ? `-${Math.floor(i / FILE_CHUNK) + 1}` : ""
        saveBlob(res.data, zip ? `certificats-${new Date().toISOString().slice(0, 10)}${part}.zip` : `certificat-${slug(baseName)}.pdf`)
        setProgress(ids.length > FILE_CHUNK ? { done: Math.min(i + FILE_CHUNK, ids.length), total: ids.length } : null)
      }
      refresh()
    } catch (e) {
      toast.error(await blobMessage(e))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  return { busy, progress, send, issue, download }
}