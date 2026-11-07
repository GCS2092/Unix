import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const input =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const chip = "min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold hover:bg-black/5 disabled:opacity-50"

type Summary = { tracked: boolean; total: number; paid: number; balance: number; status: "pending" | "deposit_paid" | "settled" }
type Payment = { id: number; amount: number; method: string; purpose: string; reference: string | null; paid_at: string | null; note: string | null; from_order: boolean; recorded_by: string | null }
type Data = {
  enrollment_id: number; user_name: string | null; course_title: string | null; summary: Summary; deposit: number; due_at: string | null; overdue: boolean
  access: { policy: string; override: "granted" | "blocked" | null; granted: boolean }
  payments: Payment[]
}

/** Dossier de paiement d'une inscription : solde, motifs, historique, modification, suivi et acces. */
export default function EnrollmentPaymentsModal({ enrollmentId, onClose }: { enrollmentId: number; onClose: () => void }) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const money = (n: number) => `${n.toLocaleString(fr ? "fr-FR" : "en-US")} FCFA`
  const qc = useQueryClient()
  const key = ["enrollment-payments", enrollmentId]
  const formRef = useRef<HTMLFormElement>(null)

  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [purpose, setPurpose] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [paidAt, setPaidAt] = useState("")
  const [notify, setNotify] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [trackPrice, setTrackPrice] = useState("")
  const [trackPaid, setTrackPaid] = useState("")
  const [trackMethod, setTrackMethod] = useState("cash")
  const [trackNote, setTrackNote] = useState("")
  const [trackInit, setTrackInit] = useState(false)

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

  const d = q.data
  const s = d?.summary
  if (d && !trackInit) {
    setTrackInit(true)
    setTrackPrice(String(d.summary.total))
    setTrackPaid(String(d.summary.total))
  }

  const purposes: [string, string][] = [
    ["deposit", L("Acompte", "Deposit")], ["balance", L("Solde", "Balance")], ["full", L("Paiement total", "Full payment")],
    ["registration", L("Frais d'inscription", "Registration fee")], ["previous", L("Reprise antérieure", "Previous payments")], ["other", L("Autre", "Other")],
  ]
  const purposeLabel = (p: string) => purposes.find((x) => x[0] === p)?.[1] ?? p
  const methods: [string, string][] = [
    ["cash", L("Espèces", "Cash")], ["transfer", L("Virement", "Bank transfer")], ["mobile_money", "Mobile money"],
    ["card", L("Carte", "Card")], ["other", L("Autre", "Other")],
  ]
  const methodLabel = (m: string) => methods.find((x) => x[0] === m)?.[1] ?? m

  async function refresh(data: Data) {
    qc.setQueryData(key, data)
    await qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
    await qc.invalidateQueries({ queryKey: ["admin-formation-payments"] })
  }

  function resetForm() {
    setAmount(""); setPurpose(""); setReference(""); setNote(""); setPaidAt(""); setMethod("cash"); setEditId(null); setErrors({})
  }

  function startEdit(p: Payment) {
    setEditId(p.id); setAmount(String(p.amount)); setMethod(p.method); setPurpose(p.purpose)
    setReference(p.reference ?? ""); setNote(p.note ?? ""); setPaidAt(p.paid_at ? p.paid_at.slice(0, 10) : ""); setErrors({})
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }))
  }

  const onErr = (e: unknown) => {
    const f = getFieldErrors(e)
    setErrors(f)
    if (Object.keys(f).length === 0) toast.error(getErrorMessage(e))
  }

  const body = () => ({
    amount: Number(amount), method, ...(purpose ? { purpose } : {}),
    reference: reference.trim() || null, note: note.trim() || null, ...(paidAt ? { paid_at: paidAt } : {}),
    ...(editId === null ? { notify } : {}),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (editId !== null) return (await apiClient.patch<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments/${editId}`, body())).data.data
      return (await apiClient.post<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments`, body())).data.data
    },
    onSuccess: async (data) => {
      toast.success(editId !== null ? L("Versement modifié.", "Payment updated.") : L("Versement enregistré.", "Payment recorded."))
      resetForm()
      await refresh(data)
    },
    onError: onErr,
  })

  const del = useMutation({
    mutationFn: async (id: number) => (await apiClient.delete<{ data: Data }>(`/admin/enrollments/${enrollmentId}/payments/${id}`)).data.data,
    onSuccess: async (data) => { toast.success(L("Versement supprimé.", "Payment deleted.")); resetForm(); await refresh(data) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const access = useMutation({
    mutationFn: async (override: "granted" | "blocked" | null) =>
      (await apiClient.patch<{ data: Data }>(`/admin/enrollments/${enrollmentId}/access`, { override })).data.data,
    onSuccess: async (data) => { toast.success(L("Accès mis à jour.", "Access updated.")); await refresh(data) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const track = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ data: Data }>(`/admin/enrollments/${enrollmentId}/tracking`, {
        agreed_price: Number(trackPrice), already_paid: Number(trackPaid || 0), method: trackMethod, note: trackNote.trim() || null,
      })).data.data,
    onSuccess: async (data) => { toast.success(L("Suivi des paiements activé.", "Payment tracking enabled.")); await refresh(data) },
    onError: onErr,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isInteger(n) || n < 1) { setErrors({ amount: L("Indiquez un montant entier supérieur à 0.", "Enter a whole amount above 0.") }); return }
    setErrors({})
    save.mutate()
  }

  const tp = Number(trackPrice) || 0
  const tpaid = Number(trackPaid) || 0
  const wouldLock = !!d && !d.access.override && ((d.access.policy === "settled" && tpaid < tp) || (d.access.policy === "deposit" && tpaid === 0 && tp > 0))

  function submitTrack(e: FormEvent) {
    e.preventDefault()
    if (!Number.isInteger(tp) || tp < 0) { setErrors({ agreed_price: L("Indiquez un prix entier.", "Enter a whole price.") }); return }
    if (!Number.isInteger(tpaid) || tpaid < 0 || tpaid > tp) { setErrors({ already_paid: L("Le montant déjà payé doit être entre 0 et le prix.", "Amount already paid must be between 0 and the price.") }); return }
    if (wouldLock && !window.confirm(L("Avec ces montants, l'étudiant perdra l'accès au cours selon la règle de la formation. Continuer ?", "With these amounts the student will lose access under the course rule. Continue?"))) return
    setErrors({})
    track.mutate()
  }

  const statusLabel = s?.status === "settled" ? L("Soldée", "Settled") : s?.status === "deposit_paid" ? L("Acompte payé", "Deposit paid") : L("En attente de paiement", "Awaiting payment")
  const statusCls = s?.status === "settled" ? "bg-success/10 text-success" : s?.status === "deposit_paid" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent-dark"
  const showForm = !!s && s.tracked && (s.balance > 0 || editId !== null)

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

            {s.tracked && s.balance > 0 && d.due_at && (
              <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${d.overdue ? "bg-danger/10 text-danger" : "bg-accent/15 text-accent-dark"}`}>
                {d.overdue ? L("Échéance dépassée depuis le ", "Overdue since ") : L("Solde à régler avant le ", "Balance due before ")}
                {new Date(d.due_at).toLocaleDateString(fr ? "fr-FR" : "en-GB")}
              </p>
            )}
            {!s.tracked && (
              <form onSubmit={submitTrack} noValidate className="space-y-3 rounded-xl border border-line p-4">
                <h3 className="text-sm font-bold">{L("Activer le suivi des paiements", "Enable payment tracking")}</h3>
                <p className="text-xs text-muted">{L("Indiquez le prix convenu et ce que l'étudiant a déjà payé. Par défaut, tout est considéré payé : rien ne change pour lui.", "Enter the agreed price and what the student already paid. By default everything counts as paid: nothing changes for them.")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    {L("Prix convenu (FCFA)", "Agreed price (FCFA)")}
                    <input inputMode="numeric" value={trackPrice} onChange={(e) => setTrackPrice(e.target.value.replace(/\D/g, ""))} className={input} />
                    {errors.agreed_price && <span className="mt-1 block text-xs text-danger">{errors.agreed_price}</span>}
                  </label>
                  <label className="block text-sm font-medium">
                    {L("Déjà payé (FCFA)", "Already paid (FCFA)")}
                    <input inputMode="numeric" value={trackPaid} onChange={(e) => setTrackPaid(e.target.value.replace(/\D/g, ""))} className={input} />
                    {errors.already_paid && <span className="mt-1 block text-xs text-danger">{errors.already_paid}</span>}
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  {L("Moyen utilisé", "Method used")}
                  <select value={trackMethod} onChange={(e) => setTrackMethod(e.target.value)} className={input}>
                    {methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {L("Note (facultatif)", "Note (optional)")}
                  <input value={trackNote} onChange={(e) => setTrackNote(e.target.value)} maxLength={255} className={input} />
                </label>
                {wouldLock && <p role="alert" className="rounded-lg bg-accent/15 px-3 py-2 text-xs font-semibold text-accent-dark">{L("Attention : avec ces montants, l'étudiant perdra l'accès au cours selon la règle de la formation.", "Warning: with these amounts the student will lose access under the course rule.")}</p>}
                <button type="submit" disabled={track.isPending} className="min-h-[44px] w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50">
                  {track.isPending ? L("Activation…", "Enabling…") : L("Activer le suivi", "Enable tracking")}
                </button>
              </form>
            )}

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
                {d.access.override !== "granted" && <button type="button" disabled={access.isPending} onClick={() => access.mutate("granted")} className={chip}>{L("Accorder l'accès", "Grant access")}</button>}
                {d.access.override !== "blocked" && <button type="button" disabled={access.isPending} onClick={() => access.mutate("blocked")} className={`${chip} text-danger hover:bg-danger/5`}>{L("Suspendre l'accès", "Suspend access")}</button>}
                {d.access.override && <button type="button" disabled={access.isPending} onClick={() => access.mutate(null)} className={chip}>{L("Revenir à la règle", "Back to course rule")}</button>}
              </div>
            </div>

            {showForm && (
              <form ref={formRef} onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-line p-4">
                <h3 className="text-sm font-bold">{editId !== null ? L("Modifier le versement", "Edit payment") : L("Enregistrer un paiement reçu", "Record a payment received")}</h3>
                {editId === null && (
                  <div className="flex flex-wrap gap-2">
                    {d.deposit > 0 && s.paid === 0 && (
                      <button type="button" onClick={() => { setAmount(String(Math.min(d.deposit, s.balance))); setPurpose("deposit") }} className={chip}>
                        {L("Acompte", "Deposit")} · {money(Math.min(d.deposit, s.balance))}
                      </button>
                    )}
                    <button type="button" onClick={() => { setAmount(String(s.balance)); setPurpose(s.paid === 0 ? "full" : "balance") }} className={chip}>
                      {L("Solde complet", "Full balance")} · {money(s.balance)}
                    </button>
                  </div>
                )}
                <label className="block text-sm font-medium">
                  {L("Montant (FCFA)", "Amount (FCFA)")}
                  <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className={input} />
                  {errors.amount && <span className="mt-1 block text-xs text-danger">{errors.amount}</span>}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    {L("Motif", "Purpose")}
                    <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input}>
                      <option value="">{L("Automatique (selon le montant)", "Automatic (by amount)")}</option>
                      {purposes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {errors.purpose && <span className="mt-1 block text-xs text-danger">{errors.purpose}</span>}
                  </label>
                  <label className="block text-sm font-medium">
                    {L("Moyen de paiement", "Method")}
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                      {methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  {L("Date du paiement (facultatif)", "Payment date (optional)")}
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={input} />
                  {errors.paid_at && <span className="mt-1 block text-xs text-danger">{errors.paid_at}</span>}
                </label>
                <label className="block text-sm font-medium">
                  {L("Référence (facultatif)", "Reference (optional)")}
                  <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={input} />
                </label>
                <label className="block text-sm font-medium">
                  {L("Note (facultatif)", "Note (optional)")}
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} className={input} />
                </label>
                {editId === null && (
                  <label className="flex min-h-[44px] items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    {L("Envoyer un e-mail de confirmation à l'étudiant", "Email a confirmation to the student")}
                  </label>
                )}
                <div className="flex gap-2">
                  {editId !== null && <button type="button" onClick={resetForm} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-semibold hover:bg-black/5">{L("Annuler", "Cancel")}</button>}
                  <button type="submit" disabled={save.isPending} className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50">
                    {save.isPending ? L("Enregistrement…", "Saving…") : editId !== null ? L("Enregistrer les modifications", "Save changes") : L("Enregistrer le versement", "Record payment")}
                  </button>
                </div>
              </form>
            )}

            <div>
              <h3 className="text-sm font-bold">{L("Historique", "History")}</h3>
              {d.payments.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{L("Aucun versement enregistré.", "No payment recorded.")}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {d.payments.map((p) => (
                    <li key={p.id} className="px-3 py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{money(p.amount)} · {purposeLabel(p.purpose)}</p>
                          <p className="text-xs text-muted">
                            {methodLabel(p.method)}{p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString(fr ? "fr-FR" : "en-GB")}` : ""}
                            {p.reference ? ` · ${p.reference}` : ""}{p.recorded_by ? ` · ${p.recorded_by}` : ""}{p.from_order ? ` · ${L("commande", "order")}` : ""}
                          </p>
                          {p.note && <p className="mt-0.5 text-xs text-muted">{p.note}</p>}
                        </div>
                        {!p.from_order && (
                          <div className="flex shrink-0 gap-1">
                            <button type="button" onClick={() => startEdit(p)} className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-primary hover:bg-black/5">{L("Modifier", "Edit")}</button>
                            <button type="button" disabled={del.isPending}
                              onClick={() => { if (window.confirm(L("Supprimer ce versement ?", "Delete this payment?"))) del.mutate(p.id) }}
                              className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">
                              {L("Supprimer", "Delete")}
                            </button>
                          </div>
                        )}
                      </div>
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