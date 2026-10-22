import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../api/client"
import { buttonClass } from "./buttonStyles"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"

/** Bouton etudiant : recevoir son certificat par e-mail. */
export default function EmailCertificateButton({ enrollmentId }: { enrollmentId: number }) {
  const { i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  const send = useMutation({
    mutationFn: () => apiClient.post<{ data: { email: string } }>(`/enrollments/${enrollmentId}/certificate/email`),
    onSuccess: (res) => toast.success(en ? `Certificate sent to ${res.data.data.email}.` : `Certificat envoyé à ${res.data.data.email}.`),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <button type="button" className={buttonClass({ size: "sm", variant: "secondary" })} disabled={send.isPending} onClick={() => send.mutate()}>
      {send.isPending ? (en ? "Sending…" : "Envoi…") : (en ? "Receive by email" : "Recevoir par e-mail")}
    </button>
  )
}