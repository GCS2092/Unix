import { useEffect, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { panel } from "../../components/admin/PageHeader"
import { Pill } from "../../components/admin/ui"
import { Avatar, Hero, SearchBox, Segmented } from "../../components/admin/formationUi"
import EnrollmentPaymentsModal from "../../components/admin/EnrollmentPaymentsModal"

const sel = "min-h-[44px] rounded-lg border border-line bg-surface px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

type Meta = { current_page: number; last_page: number; total: number }
type Totals = { collected: number; outstanding: number; pending: number; deposit_paid: number; settled: number; legacy_count: number }
type BalanceRow = {
  id: number; tracked: boolean; user_name: string | null; user_email: string | null; user_phone: string | null; course_title: string | null
  total: number; paid: number; balance: number; status: "pending" | "deposit_paid" | "settled" | "legacy"
  access_granted: boolean; access_override: "granted" | "blocked" | null; created_at: string | null
}
type HistoryRow = {
  id: number; enrollment_id: number; amount: number; method: string; purpose: string; reference: string | null; paid_at: string | null
  note: string | null; from_order: boolean; recorded_by: string | null; user_name: string | null; user_email: string | null; course_title: string | null
}
type Resp<T> = { data: T[]; totals: Totals; meta: Meta }

/** Paiements de la formation : soldes par etudiant, motifs et historique des versements. */
export default function AdminFormationPaymentsPage() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const locale = fr ? "fr-FR" : "en-US"
  const money = (n: number) => `${n.toLocaleString(locale)} FCFA`
  const qc = useQueryClient()

  const [view, setView] = useState<"balances" | "history">("balances")
  const [status, setStatus] = useState("")
  const [method, setMethod] = useState("")
  const [purpose, setPurpose] = useState("")
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [payFor, setPayFor] = useState<number | null>(null)

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const bal = useQuery({
    queryKey: ["admin-formation-payments", "balances", page, q, status],
    queryFn: async () => (await apiClient.get<Resp<BalanceRow>>("/admin/formation-payments", { params: { page, q, status } })).data,
    enabled: view === "balances",
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const his = useQuery({
    queryKey: ["admin-formation-payments", "history", page, q, method, purpose],
    queryFn: async () => (await apiClient.get<Resp<HistoryRow>>("/admin/formation-payments/history", { params: { page, q, method, purpose } })).data,
    enabled: view === "history",
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const active = view === "balances" ? bal : his
  const totals = (bal.data ?? his.data)?.totals
  const meta = active.data?.meta
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : "")
  const methods: Record<string, string> = {
    cash: L("Espèces", "Cash"), transfer: L("Virement", "Bank transfer"), mobile_money: "Mobile money",
    card: L("Carte", "Card"), other: L("Autre", "Other"),
  }
  const purposes: Record<string, string> = {
    deposit: L("Acompte", "Deposit"), balance: L("Solde", "Balance"), full: L("Paiement total", "Full payment"),
    registration: L("Frais d'inscription", "Registration fee"), previous: L("Reprise antérieure", "Previous payments"), other: L("Autre", "Other"),
  }

  const statusPill = (s: BalanceRow["status"]) =>
    s === "settled" ? <Pill tone="success" dot>{L("Soldée", "Settled")}</Pill>
    : s === "deposit_paid" ? <Pill tone="info" dot>{L("Acompte payé", "Deposit paid")}</Pill>
    : s === "legacy" ? <Pill tone="info" dot>{L("Antérieure · soldée", "Earlier · settled")}</Pill>
    : <Pill tone="warn" dot>{L("À payer", "Unpaid")}</Pill>

  function closeModal() {
    setPayFor(null)
    void qc.invalidateQueries({ queryKey: ["admin-formation-payments"] })
  }

  const tile = "rounded-card border border-line bg-surface p-4 shadow-card"

  return (
    <div>
      <Hero
        title={L("Paiements", "Payments")}
        count={meta?.total}
        subtitle={L("Suivez ce que chaque étudiant a payé, pour quel motif, et ce qu'il reste à encaisser.", "Track what each student has paid, for what purpose, and what is still due.")}
      />

      {totals && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className={tile}><p className="text-xs font-medium text-muted">{L("Encaissé", "Collected")}</p><p className="mt-1 text-xl font-bold text-success sm:text-2xl">{money(totals.collected)}</p></div>
          <div className={tile}><p className="text-xs font-medium text-muted">{L("Reste à encaisser", "Outstanding")}</p><p className="mt-1 text-xl font-bold text-accent-dark sm:text-2xl">{money(totals.outstanding)}</p></div>
          <div className={tile}>
            <p className="text-xs font-medium text-muted">{L("Dossiers", "Files")}</p>
            <p className="mt-1 text-sm font-semibold">{totals.pending} {L("à payer", "unpaid")} · {totals.deposit_paid} {L("acompte", "deposit")} · {totals.settled} {L("soldés", "settled")}</p>
            {totals.legacy_count > 0 && <p className="mt-1 text-xs text-muted">{totals.legacy_count} {L("inscription(s) antérieure(s) non suivie(s)", "earlier enrollment(s) not tracked")}</p>}
          </div>
        </div>
      )}

      <div className="mb-3">
        <Segmented
          tour="pay-view" value={view}
          onChange={(v) => { setView(v as "balances" | "history"); setPage(1) }}
          items={[{ id: "balances", label: L("Soldes", "Balances") }, { id: "history", label: L("Versements", "Payments") }]}
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox tour="pay-search" value={input} onChange={setInput} placeholder={L("Étudiant ou e-mail", "Student or e-mail")} />
        {view === "balances" ? (
          <Segmented
            tour="pay-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }}
            items={[
              { id: "", label: L("Tous", "All") },
              { id: "pending", label: L("À payer", "Unpaid") },
              { id: "deposit_paid", label: L("Acompte", "Deposit") },
              { id: "settled", label: L("Soldés", "Settled") },
              { id: "legacy", label: L("Non suivies", "Not tracked") },
            ]}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={L("Motif", "Purpose")} value={purpose} onChange={(e) => { setPurpose(e.target.value); setPage(1) }} className={sel}>
              <option value="">{L("Tous les motifs", "All purposes")}</option>
              {Object.entries(purposes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select aria-label={L("Moyen", "Method")} value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} className={sel}>
              <option value="">{L("Tous les moyens", "All methods")}</option>
              {Object.entries(methods).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      {active.isLoading && <LoadingState />}
      {active.error && <ErrorState error={active.error} onRetry={() => void active.refetch()} />}
      {active.data && active.data.data.length === 0 && (
        <EmptyState message={view === "balances" ? L("Aucun dossier de paiement.", "No payment file.") : L("Aucun versement enregistré.", "No payment recorded.")} />
      )}

      {view === "balances" && bal.data && bal.data.data.length > 0 && (
        <ul className="space-y-3">
          {bal.data.data.map((e) => (
            <li key={e.id} className={panel}>
              <div className="flex items-start gap-3">
                <Avatar name={e.user_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{e.user_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">{e.user_email ?? ""}{e.user_phone ? ` · ${e.user_phone}` : ""}</p>
                  <p className="mt-1 text-sm font-medium">{e.course_title ?? "—"}</p>
                </div>
                {statusPill(e.status)}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div><dt className="text-xs text-muted">{L("Prix", "Price")}</dt><dd className="text-sm font-bold">{money(e.total)}</dd></div>
                <div><dt className="text-xs text-muted">{L("Payé", "Paid")}</dt><dd className="text-sm font-bold text-success">{money(e.paid)}</dd></div>
                <div><dt className="text-xs text-muted">{L("Reste", "Balance")}</dt><dd className="text-sm font-bold text-accent-dark">{money(e.balance)}</dd></div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-xs text-muted">
                  {L("Accès", "Access")} : {e.access_granted ? L("autorisé", "allowed") : L("suspendu", "suspended")}{e.access_override ? ` (${L("manuel", "manual")})` : ""}
                </span>
                <button type="button" onClick={() => setPayFor(e.id)} className="min-h-[36px] rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95">
                  {e.tracked ? L("Gérer", "Manage") : L("Activer le suivi", "Enable tracking")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {view === "history" && his.data && his.data.data.length > 0 && (
        <ul className="space-y-3">
          {his.data.data.map((p) => (
            <li key={p.id} className={panel}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {money(p.amount)}
                    <Pill tone="info">{purposes[p.purpose] ?? p.purpose}</Pill>
                  </p>
                  <p className="mt-1 text-sm">{p.user_name ?? "—"} · <span className="text-muted">{p.course_title ?? "—"}</span></p>
                  <p className="mt-1 text-xs text-muted">
                    {methods[p.method] ?? p.method}{p.paid_at ? ` · ${date(p.paid_at)}` : ""}{p.reference ? ` · ${p.reference}` : ""}{p.recorded_by ? ` · ${p.recorded_by}` : ""}{p.from_order ? ` · ${L("commande", "order")}` : ""}
                  </p>
                  {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
                </div>
                <button type="button" onClick={() => setPayFor(p.enrollment_id)} className="min-h-[36px] shrink-0 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-black/5">
                  {L("Voir le dossier", "Open file")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta && <Pagination meta={meta} onChange={setPage} />}
      {payFor !== null && <EnrollmentPaymentsModal enrollmentId={payFor} onClose={closeModal} />}
    </div>
  )
}