import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type PaymentSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

const input = "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function Form({ initial }: { initial: PaymentSettings }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [form, setForm] = useState<PaymentSettings>(initial)
  const set = (k: keyof PaymentSettings, v: string) => setForm((s) => ({ ...s, [k]: v }))

  const save = useMutation({
    mutationFn: () => adminApi.updatePaymentSettings(form),
    onSuccess: async () => {
      toast.success(L("Enregistr\u00e9", "Saved"))
      await qc.invalidateQueries({ queryKey: ["admin-pay-settings"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const rows: { key: keyof PaymentSettings; label: string; ph?: string; area?: boolean }[] = [
    { key: "pay_wave", label: "Wave", ph: "+221 77 000 00 00" },
    { key: "pay_orange_money", label: "Orange Money", ph: "+221 77 000 00 00" },
    { key: "pay_free_money", label: "Free Money", ph: "+221 76 000 00 00" },
    { key: "pay_transfer", label: L("Virement bancaire (IBAN, titulaire)", "Bank transfer (IBAN, holder)"), area: true },
    { key: "pay_note_fr", label: L("Consigne affich\u00e9e au client (fran\u00e7ais)", "Customer instructions (French)"), area: true },
    { key: "pay_note_en", label: L("Consigne affich\u00e9e au client (anglais)", "Customer instructions (English)"), area: true },
  ]

  return (
    <div className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">
        {L("Un champ vide n'est pas affich\u00e9 au client. Ces informations ne sont visibles que sur les commandes en attente de paiement.", "An empty field is not shown to the customer. This information only appears on orders awaiting payment.")}
      </p>
      {rows.map((r) => (
        <label key={r.key} className="block text-sm">
          <span className="font-medium">{r.label}</span>
          {r.area ? (
            <textarea rows={3} maxLength={500} className={input} value={form[r.key]} onChange={(e) => set(r.key, e.target.value)} />
          ) : (
            <input className={input} maxLength={200} placeholder={r.ph} value={form[r.key]} onChange={(e) => set(r.key, e.target.value)} />
          )}
        </label>
      ))}
      <Button loading={save.isPending} onClick={() => save.mutate()}>{L("Enregistrer", "Save")}</Button>
    </div>
  )
}

export default function PaymentSettingsForm() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-pay-settings"],
    queryFn: async () => {
      const d = (await adminApi.communicationSettings()).data.data as unknown as Partial<PaymentSettings>
      return {
        pay_wave: d.pay_wave ?? "",
        pay_orange_money: d.pay_orange_money ?? "",
        pay_free_money: d.pay_free_money ?? "",
        pay_transfer: d.pay_transfer ?? "",
        pay_note_fr: d.pay_note_fr ?? "",
        pay_note_en: d.pay_note_en ?? "",
      } satisfies PaymentSettings
    },
    staleTime: 0,
  })
  return (
    <>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <Form key={JSON.stringify(data)} initial={data} />}
    </>
  )
}