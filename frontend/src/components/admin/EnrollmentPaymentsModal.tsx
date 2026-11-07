import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const input =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

type Summary = { tracked: boolean; total: number; paid: number; balance: number; status: "pending" | "deposit_paid" | "settled" }
type Payment = { id: number; amount: number; method: string; reference: string | null; paid_at: string | null; note: string | null; from_order: boolean; recorded_by: string | null }
type Data = { enrollment_id: number; user_name: string | null; course_title: string | null; summary: Summary; deposit: number; payments: Payment[]; access: { policy: string; override: "granted" | "blocked" | null; granted: boolean } }

/** Versements d'une inscription : solde, historique et enregistrement d'un paiement (espèces, virement...). */
export default function EnrollmentPaymentsModal({ enrollmentId, onClose }: { enrollmentId: number; onClose: () => void }) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const money = (n: number) => `${n.toLocaleString(fr ? "fr-FR" : "en-US")} FCFA`
  const qc = useQueryClient()
  const key = ["enrollment-payments", enrollmentId]

  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await apiClient.get<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments`)).data.data,
    staleTime: 0,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function refresh(d: Data) {
    qc.setQueryData(key, d)
    await qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
  }

  const add = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments`, {
        amount: Number(amount), method, reference: reference.trim() || null, note: note.trim() || null,
      })).data.data,
    onSuccess: async (d) => { toast.success(L("Versement enregistré.", "Payment recorded.")); setAmount(""); setReference(""); setNote(""); setErrors({}); await refresh(d) },
    onError: (e) => { const f = getFieldErrors(e); setErrors(f); if (Object.keys(f).length === 0) toast.error(getErrorMessage(e)) },
  })

  const del = useMutation({
    mutationFn: async (id: number) => (await apiClient.delete<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments/${id}`)).data.data,
    onSuccess: async (d) => { toast.success(L("Versement supprimé.", "Payment deleted.")); await refresh(d) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const access = useMutation({
    mutationFn: async (override: "granted" | "blocked" | null) =>
      (await apiClient.patch<{ data: Data }>(`/admin/enrollments/${enrollmentId}/access`, { override })).data.data,
    onSuccess: async (d) => { toast.success(L("Accès mis à jour.", "Access updated.")); await refresh(d) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isInteger(n) || n < 1) { setErrors({ amount: L("Indiquez un montant entier supérieur à 0.", "Enter a whole amount above 0.") }); return }
    setErrors({})
    add.mutate()
  }

  const d = q.data
  const s = d?.summary
  const methods: [string, string][] = [
    ["cash", L("Espèces", "Cash")], ["transfer", L("Virement", "Bank transfer")], ["mobile_money", "Mobile money"],
    ["card", L("Carte", "Card")], ["other", L("Autre", "Other")],
  ]
  const statusLabel = s?.status === "settled" ? L("Soldée", "Settled") : s?.status === "deposit_paid" ? L("Acompte payé", "Deposit paid") : L("En attente de paiement", "Awaiting payment")
  const statusCls = s?.status === "settled" ? "bg-success/10 text-success" : s?.status === "deposit_paid" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent-dark"

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={L("Paiements", "Payments")}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-card-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{L("Paiements", "Payments")}</h2>
            {d && <p className="mt-0.5 text-sm text-muted">{d.user_name} · {d.course_title}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={L("Fermer", "Close")} className="min-h-[44px] min-w-[44px] rounded-lg text-xl text-muted hover:bg-black/5">×</button>
        </div>

        {q.isLoading && <p className="text-sm text-muted">{L("Chargement…", "Loading…")}</p>}
        {q.isError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(q.error)}</p>}

        {d && s && (
          <>
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted">{L("Situation", "Status")}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusCls}`}>{statusLabel}</span>
              </div>
              {!s.tracked ? (
                <p className="mt-3 text-sm text-muted">{L("Inscription antérieure au suivi des paiements : elle est considérée comme soldée.", "Enrollment created before payment tracking: considered settled.")}</p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div><dt className="text-xs text-muted">{L("Prix", "Price")}</dt><dd className="mt-0.5 text-sm font-bold">{money(s.total)}</dd></div>
                  <div><dt className="text-xs text-muted">{L("Payé", "Paid")}</dt><dd className="mt-0.5 text-sm font-bold text-success">{money(s.paid)}</dd></div>
                  <div><dt className="text-xs text-muted">{L("Reste", "Balance")}</dt><dd className="mt-0.5 text-sm font-bold text-accent-dark">{money(s.balance)}</dd></div>
                </dl>
              )}
            </div>

            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted">{L("Accès au cours", "Course access")}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${d.access.granted ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                  {d.access.granted ? L("Autorisé", "Allowed") : L("Suspendu", "Suspended")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {d.access.override
                  ? L("Décision manuelle de l'administration.", "Manual decision by the administration.")
                  : d.access.policy === "deposit"
                    ? L("Règle de la formation : accès dès que l'acompte est payé.", "Course rule: access once the deposit is paid.")
                    : d.access.policy === "settled"
                      ? L("Règle de la formation : accès une fois le solde payé.", "Course rule: access once fully paid.")
                      : L("Règle de la formation : accès immédiat.", "Course rule: immediate access.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.access.override !== "granted" && (
                  <button type="button" disabled={access.isPending} onClick={() => access.mutate("granted")} className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold hover:bg-black/5 disabled:opacity-50">{L("Accorder l'accès", "Grant access")}</button>
                )}
                {d.access.override !== "blocked" && (
                  <button type="button" disabled={access.isPending} onClick={() => access.mutate("blocked")} className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-50">{L("Suspendre l'accès", "Suspend access")}</button>
                )}
                {d.access.override && (
                  <button type="button" disabled={access.isPending} onClick={() => access.mutate(null)} className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold hover:bg-black/5 disabled:opacity-50">{L("Revenir à la règle", "Back to course rule")}</button>
                )}
              </div>
            </div>

            {s.tracked && s.balance > 0 && (
              <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-line p-4">
                <h3 className="text-sm font-bold">{L("Enregistrer un paiement reçu", "Record a payment received")}</h3>
                <div className="flex flex-wrap gap-2">
                  {d.deposit > 0 && s.paid === 0 && (
                    <button type="button" onClick={() => setAmount(String(Math.min(d.deposit, s.balance)))} className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold hover:bg-black/5">
                      {L("Acompte", "Deposit")} · {money(Math.min(d.deposit, s.balance))}
                    </button>
                  )}
                  <button type="button" onClick={() => setAmount(String(s.balance))} className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold hover:bg-black/5">
                    {L("Solde complet", "Full balance")} · {money(s.balance)}
                  </button>
                </div>
                <label className="block text-sm font-medium">
                  {L("Montant (FCFA)", "Amount (FCFA)")}
                  <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className={input} />
                  {errors.amount && <span className="mt-1 block text-xs text-danger">{errors.amount}</span>}
                </label>
                <label className="block text-sm font-medium">
                  {L("Moyen de paiement", "Method")}
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                    {methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {L("Référence (facultatif)", "Reference (optional)")}
                  <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={input} />
                </label>
                <label className="block text-sm font-medium">
                  {L("Note (facultatif)", "Note (optional)")}
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} className={input} />
                </label>
                <button type="submit" disabled={add.isPending} className="min-h-[44px] w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50">
                  {add.isPending ? L("Enregistrement…", "Saving…") : L("Enregistrer le versement", "Record payment")}
                </button>
              </form>
            )}

            <div>
              <h3 className="text-sm font-bold">{L("Historique", "History")}</h3>
              {d.payments.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{L("Aucun versement enregistré.", "No payment recorded.")}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold">{money(p.amount)} · {methods.find((m) => m[0] === p.method)?.[1] ?? p.method}</p>
                        <p className="truncate text-xs text-muted">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString(fr ? "fr-FR" : "en-GB") : ""}
                          {p.reference ? ` · ${p.reference}` : ""}{p.recorded_by ? ` · ${p.recorded_by}` : ""}{p.from_order ? ` · ${L("commande", "order")}` : ""}
                        </p>
                      </div>
                      {!p.from_order && (
                        <button type="button" disabled={del.isPending}
                          onClick={() => { if (window.confirm(L("Supprimer ce versement ?", "Delete this payment?"))) del.mutate(p.id) }}
                          className="min-h-[36px] shrink-0 rounded-lg px-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">
                          {L("Supprimer", "Delete")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}