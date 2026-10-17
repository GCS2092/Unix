import { useEffect, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import type { MarkPaidPayload, PaymentRow, PaymentTab } from "../../api/admin"
import type { AdminOrder } from "../../types"
import { formatPrice } from "../../lib/format"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import MarkPaidDialog from "../../components/MarkPaidDialog"
import { Drawer, PageHeader, Pill, StatCard, Svg, Tabs } from "../../components/admin/ui"
import { inputClass, labelClass } from "../../components/admin/adminStyles"

const TAB_IDS: PaymentTab[] = ["to_verify", "pending", "failed", "anomalies", "paid_today", "all"]

const I_CHECK = "M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12.5l2.5 2.5 4.5-5"
const I_CLOCK = "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z"
const I_X = "M12 21a9 9 0 100-18 9 9 0 000 18zM15 9l-6 6M9 9l6 6"
const I_ALERT = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
const I_COIN = "M12 21a9 9 0 100-18 9 9 0 000 18zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"
const I_SEARCH = "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"

const ANOMALY_LABELS: Record<string, string> = {
  amount_mismatch: "Montant incohérent",
  stock_missing: "Payé, stock manquant",
  other: "Anomalie",
}

const VERIFY_LABELS: Record<string, string> = {
  paid: "payée(s)",
  already_paid: "déjà payée(s)",
  anomaly: "en anomalie",
  refused: "refusée(s)",
  waiting: "toujours en attente",
  not_found: "introuvable(s)",
  no_transaction: "sans transaction",
  error: "en erreur",
}

function errMsg(e: unknown): string {
  const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  return first ?? d?.message ?? "Une erreur est survenue."
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—")

const anomalyLabel = (r: PaymentRow) => (r.anomaly ? ANOMALY_LABELS[r.anomaly] ?? "Anomalie" : "Payé, stock manquant")
const hasAnomaly = (r: PaymentRow) => Boolean(r.anomaly) || r.stock_conflict
const isOpen = (r: PaymentRow) => r.status === "pending" || r.status === "failed"

function StatusPill({ r }: { r: PaymentRow }) {
  if (hasAnomaly(r)) return <Pill tone="danger" dot>{anomalyLabel(r)}</Pill>
  if (r.refunded_at) return <Pill tone="info" dot>Remboursé</Pill>
  switch (r.bucket) {
    case "paid": return <Pill tone="success" dot>Payé</Pill>
    case "to_verify": return <Pill tone="warn" dot>À vérifier</Pill>
    case "failed": return <Pill tone="danger" dot>Échoué / expiré</Pill>
    case "cancelled": return <Pill tone="info" dot>Annulée</Pill>
    default: return <Pill tone="info" dot>En attente</Pill>
  }
}

function PaymentInfo({ r }: { r: PaymentRow }) {
  return (
    <div className="space-y-0.5 text-xs text-muted">
      {r.bucket === "paid" && (
        <p>Payé le {fmtDate(r.paid_at)}{r.payment_method ? ` · ${r.payment_method}` : ""}{r.payment_reference ? ` · réf. ${r.payment_reference}` : ""}</p>
      )}
      {r.claimed_at && <p className="font-medium text-amber-700">Déclaré le {fmtDate(r.claimed_at)}{r.claimed_reference ? ` · réf. ${r.claimed_reference}` : ""}</p>}
      {r.claim_rejected_at && !r.claimed_at && <p>Déclaration rejetée le {fmtDate(r.claim_rejected_at)}{r.claim_rejected_reason ? ` · ${r.claim_rejected_reason}` : ""}</p>}
      {r.payment_transaction_id && <p className="break-all">Transaction : {r.payment_transaction_id}</p>}
      {r.checked_at && <p>Dernière vérification : {fmtDate(r.checked_at)}</p>}
      {r.anomaly_note && <p className="text-danger">{r.anomaly_note}</p>}
      {r.refunded_at && <p>Remboursé le {fmtDate(r.refunded_at)}{r.refund_reason ? ` · ${r.refund_reason}` : ""}</p>}
    </div>
  )
}

function Pager({ page, last, onChange }: { page: number; last: number; onChange: (p: number) => void }) {
  if (last <= 1) return null
  return (
    <div className="mt-5 flex items-center justify-between gap-3 text-sm sm:justify-center">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</Button>
      <span className="whitespace-nowrap text-muted">{page} / {last}</span>
      <Button variant="secondary" disabled={page >= last} onClick={() => onChange(page + 1)}>Suivant</Button>
    </div>
  )
}

type ReasonKind = "reject" | "refund" | "cancel" | "anomaly"

const REASON_COPY: Record<ReasonKind, { title: string; intro: string; label: string; required: boolean; confirm: string }> = {
  reject: { title: "Rejeter la déclaration", intro: "La déclaration du client est effacée : il pourra payer ou déclarer à nouveau.", label: "Motif du rejet (facultatif)", required: false, confirm: "Rejeter" },
  refund: { title: "Marquer comme remboursé", intro: "Simple suivi : aucun remboursement n'est envoyé à la passerelle. Rembourse le client de ton côté, puis note-le ici.", label: "Motif et moyen du remboursement", required: true, confirm: "Marquer remboursé" },
  cancel: { title: "Annuler la commande", intro: "Le stock réservé est libéré et la commande est annulée.", label: "Motif (facultatif)", required: false, confirm: "Annuler la commande" },
  anomaly: { title: "Anomalie traitée", intro: "Le marqueur d'anomalie est retiré. Note ce qui a été fait.", label: "Note (facultative)", required: false, confirm: "Marquer traitée" },
}

function ReasonDialog({ kind, row, pending, error, onSubmit, onClose }: {
  kind: ReasonKind; row: PaymentRow; pending: boolean; error: string; onSubmit: (text: string) => void; onClose: () => void
}) {
  const copy = REASON_COPY[kind]
  const [text, setText] = useState("")
  const [local, setLocal] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pending, onClose])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    if (copy.required && text.trim().length < 3) return setLocal("Précise un motif (3 caractères minimum).")
    setLocal("")
    onSubmit(text.trim())
  }

  const shown = local || error

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="reason-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-card border border-line bg-surface p-5 shadow-card-lg sm:max-w-md sm:rounded-card">
        <h2 id="reason-title" className="text-lg font-bold">{copy.title} · #{row.id}</h2>
        <p className="mt-1 text-sm text-muted">{formatPrice(row.total, row.currency)}{row.customer ? ` · ${row.customer}` : ""}</p>
        <p className="mt-2 text-sm text-muted">{copy.intro}</p>
        <label className={`${labelClass} mt-4 block`}>{copy.label}
          <input autoFocus maxLength={300} value={text} onChange={(e) => setText(e.target.value)} disabled={pending} className={`${inputClass} mt-1`} />
        </label>
        {shown && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{shown}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="flex min-h-[48px] items-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-page disabled:opacity-50">Fermer</button>
          <Button type="submit" size="lg" className="flex-1" loading={pending} disabled={pending}>{copy.confirm}</Button>
        </div>
      </form>
    </div>
  )
}

function HistoryDrawer({ row, onClose }: { row: PaymentRow; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["admin-payment-history", row.id],
    queryFn: async () => (await adminApi.paymentHistory(row.id)).data.data,
    staleTime: 0,
  })
  const items = q.data ?? []

  return (
    <Drawer open onClose={onClose} title={`Historique · commande #${row.id}`} subtitle={row.payment_transaction_id ?? "Aucune transaction CinetPay"}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fermer</Button></div>}>
      {q.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
      {q.error && <p role="alert" className="py-4 text-danger">{errMsg(q.error)}</p>}
      {q.data && items.length === 0 && <p className="rounded-card border border-dashed border-line py-10 text-center text-muted">Aucun événement pour cette commande.</p>}
      {items.length > 0 && (
        <ol className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-card border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{it.label}</p>
                <Pill tone={it.kind === "webhook" ? "info" : "success"}>{it.kind === "webhook" ? "Passerelle" : "Admin / système"}</Pill>
              </div>
              <p className="mt-0.5 text-xs text-muted">{fmtDate(it.at)}</p>
              {it.detail && <p className="mt-1 break-words text-sm">{it.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}

interface Actions {
  verify: (r: PaymentRow) => void
  markPaid: (r: PaymentRow) => void
  reject: (r: PaymentRow) => void
  refund: (r: PaymentRow) => void
  cancel: (r: PaymentRow) => void
  resolveConflict: (r: PaymentRow) => void
  resolveAnomaly: (r: PaymentRow) => void
  history: (r: PaymentRow) => void
  busyId: number | null
}

function RowActions({ r, a }: { r: PaymentRow; a: Actions }) {
  const busy = a.busyId === r.id
  const open = isOpen(r)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {open && r.payment_transaction_id && <Button size="sm" loading={busy} onClick={() => a.verify(r)}>Vérifier CinetPay</Button>}
      {open && <Button size="sm" variant="secondary" disabled={busy} onClick={() => a.markPaid(r)}>Valider</Button>}
      {open && r.claimed_at && <Button size="sm" variant="secondary" disabled={busy} onClick={() => a.reject(r)}>Rejeter</Button>}
      {r.stock_conflict && <Button size="sm" disabled={busy} onClick={() => a.resolveConflict(r)}>Résoudre le conflit</Button>}
      {r.anomaly && <Button size="sm" variant="secondary" disabled={busy} onClick={() => a.resolveAnomaly(r)}>Anomalie traitée</Button>}
      {r.status === "paid" && !r.refunded_at && <Button size="sm" variant="secondary" disabled={busy} onClick={() => a.refund(r)}>Marquer remboursé</Button>}
      {open && <Button size="sm" variant="secondary" disabled={busy} onClick={() => a.cancel(r)}>Annuler</Button>}
      <Button size="sm" variant="secondary" onClick={() => a.history(r)}>Historique</Button>
    </div>
  )
}

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const urlTab = params.get("tab") ?? ""
  const initialTab = (TAB_IDS as string[]).includes(urlTab) ? (urlTab as PaymentTab) : "to_verify"

  const [tab, setTab] = useState<PaymentTab>(initialTab)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "warn" } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [markFor, setMarkFor] = useState<PaymentRow | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<{ kind: ReasonKind; row: PaymentRow } | null>(null)
  const [reasonError, setReasonError] = useState("")
  const [historyFor, setHistoryFor] = useState<PaymentRow | null>(null)

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const list = useQuery({
    queryKey: ["admin-payments", page, tab, q, from, to],
    queryFn: async () => (await adminApi.payments(page, { tab, q, from, to })).data,
    staleTime: 0,
  })

  async function refresh() {
    await Promise.all(
      ["admin-payments", "admin-orders", "admin-dashboard", "admin-stock", "admin-payment-history"].map((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      ),
    )
  }

  const verifyOne = useMutation({
    mutationFn: async (r: PaymentRow) => { setBusyId(r.id); return (await adminApi.verifyPayment(r.id)).data.data },
    onSuccess: async (v, r) => {
      await refresh()
      if (v.result === "paid") toast.success(`Commande #${r.id} : ${v.message}`)
      else setNotice({ text: `Commande #${r.id} : ${v.message}`, tone: v.result === "anomaly" || v.result === "error" ? "warn" : "ok" })
    },
    onError: (e) => setNotice({ text: errMsg(e), tone: "warn" }),
    onSettled: () => setBusyId(null),
  })

  const verifyAll = useMutation({
    mutationFn: async () => (await adminApi.verifyAllPayments()).data.data,
    onSuccess: async (v) => {
      await refresh()
      if (v.checked === 0) return setNotice({ text: "Aucune commande en attente à vérifier auprès de CinetPay.", tone: "ok" })
      const detail = Object.entries(v.summary).map(([k, n]) => `${n} ${VERIFY_LABELS[k] ?? k}`).join(", ")
      const more = v.remaining > 0 ? ` ${v.remaining} autre(s) restent à vérifier : relance « Tout vérifier ».` : ""
      setNotice({ text: `${v.checked} commande(s) vérifiée(s) : ${detail}.${more}`, tone: v.summary.anomaly || v.summary.error ? "warn" : "ok" })
    },
    onError: (e) => setNotice({ text: errMsg(e), tone: "warn" }),
  })

  const markPaid = useMutation({
    mutationFn: async (p: { id: number; payload: MarkPaidPayload; hadAnomaly: boolean }) => {
      const res = await adminApi.markPaid(p.id, p.payload)
      if (p.hadAnomaly) {
        try { await adminApi.resolvePaymentAnomaly(p.id, "Validé manuellement") } catch { /* secondaire */ }
      }
      return res
    },
    onSuccess: async (_res, p) => { await refresh(); toast.success(`Commande #${p.id} marquée payée.`); setMarkFor(null) },
    onError: (e) => setMarkError(errMsg(e)),
  })

  const reasonAction = useMutation({
    mutationFn: async ({ kind, row, text }: { kind: ReasonKind; row: PaymentRow; text: string }): Promise<void> => {
      if (kind === "reject") await adminApi.rejectPaymentClaim(row.id, text)
      else if (kind === "refund") await adminApi.refundPayment(row.id, text)
      else if (kind === "cancel") await adminApi.cancelOrder(row.id, text || undefined)
      else await adminApi.resolvePaymentAnomaly(row.id, text)
    },
    onSuccess: async (_res, v) => {
      await refresh()
      toast.success(`Commande #${v.row.id} : ${REASON_COPY[v.kind].title.toLowerCase()}.`)
      setReasonFor(null)
    },
    onError: (e) => setReasonError(errMsg(e)),
  })

  const resolveConflict = useMutation({
    mutationFn: async (r: PaymentRow) => { setBusyId(r.id); return adminApi.resolveStockConflict(r.id) },
    onSuccess: async (_res, r) => { await refresh(); toast.success(`Conflit de stock résolu pour #${r.id}.`) },
    onError: (e) => setNotice({ text: errMsg(e), tone: "warn" }),
    onSettled: () => setBusyId(null),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminApi.exportPayments({ tab, q, from, to })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = `paiements-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setNotice({ text: errMsg(e), tone: "warn" })
    } finally {
      setExporting(false)
    }
  }

  const actions: Actions = {
    busyId,
    verify: (r) => verifyOne.mutate(r),
    markPaid: (r) => { setMarkError(null); setMarkFor(r) },
    reject: (r) => { setReasonError(""); setReasonFor({ kind: "reject", row: r }) },
    refund: (r) => { setReasonError(""); setReasonFor({ kind: "refund", row: r }) },
    cancel: (r) => { setReasonError(""); setReasonFor({ kind: "cancel", row: r }) },
    resolveAnomaly: (r) => { setReasonError(""); setReasonFor({ kind: "anomaly", row: r }) },
    resolveConflict: (r) => resolveConflict.mutate(r),
    history: (r) => setHistoryFor(r),
  }

  const counts = list.data?.meta.counts
  const rows = list.data?.data ?? []
  const pickTab = (t: PaymentTab) => { setTab(t); setPage(1) }
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} (${n})`)

  const tabItems: { id: PaymentTab; label: string }[] = [
    { id: "to_verify", label: withCount("À vérifier", counts?.to_verify) },
    { id: "pending", label: withCount("En attente", counts?.pending) },
    { id: "failed", label: withCount("Échoués / expirés", counts?.failed) },
    { id: "anomalies", label: withCount("Anomalies", counts?.anomalies) },
    { id: "paid_today", label: withCount("Payés aujourd'hui", counts?.paid_today) },
    { id: "all", label: "Tous" },
  ]

  const markOrder: AdminOrder | null = markFor
    ? ({ ...markFor, payment_claimed_reference: markFor.claimed_reference } as unknown as AdminOrder)
    : null

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle="Tout ce qui est à traiter : déclarations clients, paiements en attente, échecs et anomalies."
        actions={
          <>
            <Button variant="secondary" loading={verifyAll.isPending} onClick={() => verifyAll.mutate()}>Tout vérifier</Button>
            <Button variant="secondary" loading={exporting} onClick={() => void handleExport()}>Exporter en CSV</Button>
          </>
        }
      />

      {notice && (
        <p role="status" className={`mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${notice.tone === "warn" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
          <span>{notice.text}</span>
          <button type="button" className="font-semibold" onClick={() => setNotice(null)}>OK</button>
        </p>
      )}

      {counts && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          <StatCard label="À vérifier" hint="le client dit avoir payé" value={counts.to_verify} icon={I_CHECK} tone="warn" active={tab === "to_verify"} onClick={() => pickTab("to_verify")} />
          <StatCard label="En attente" value={counts.pending} icon={I_CLOCK} tone="info" active={tab === "pending"} onClick={() => pickTab("pending")} />
          <StatCard label="Échoués ou expirés" value={counts.failed} icon={I_X} tone="neutral" active={tab === "failed"} onClick={() => pickTab("failed")} />
          <StatCard label="Anomalies" hint="montant ou stock" value={counts.anomalies} icon={I_ALERT} tone="danger" active={tab === "anomalies"} onClick={() => pickTab("anomalies")} />
          <StatCard label="Encaissé aujourd'hui" hint={`${counts.paid_today} commande(s)`} value={formatPrice(counts.collected_today)} icon={I_COIN} tone="success" active={tab === "paid_today"} onClick={() => pickTab("paid_today")} />
        </div>
      )}

      <Tabs value={tab} onChange={pickTab} items={tabItems} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"><Svg d={I_SEARCH} className="h-4 w-4" /></span>
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="N° de commande, client, téléphone, transaction…" className={`${inputClass} pl-9`} />
        </div>
        <label className={labelClass}>Du
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className={`${inputClass} mt-1`} />
        </label>
        <label className={labelClass}>Au
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className={`${inputClass} mt-1`} />
        </label>
      </div>

      {list.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
      {list.error && (
        <p role="alert" className="py-4 text-danger">{errMsg(list.error)} <button type="button" className="font-semibold underline" onClick={() => void list.refetch()}>Réessayer</button></p>
      )}
      {list.data && rows.length === 0 && <p className="rounded-card border border-dashed border-line py-10 text-center text-muted">Rien à traiter ici.</p>}

      {rows.length > 0 && (
        <>
          {/* Mobile et tablette : cartes */}
          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((r) => (
              <li key={r.id} className="min-w-0 rounded-card border border-line bg-surface p-3.5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{r.id}{r.public_ref ? ` · ${r.public_ref}` : ""}</p>
                    <p className="truncate text-sm text-muted">{r.customer ?? "Client invité"}{r.phone ? ` · ${r.phone}` : ""}</p>
                  </div>
                  <p className="whitespace-nowrap text-base font-extrabold">{formatPrice(r.total, r.currency)}</p>
                </div>
                <div className="mt-2"><StatusPill r={r} /></div>
                <div className="mt-2"><PaymentInfo r={r} /></div>
                <p className="mt-2 text-xs text-muted">Commande du {fmtDate(r.created_at)}</p>
                <div className="mt-3 border-t border-line pt-3"><RowActions r={r} a={actions} /></div>
              </li>
            ))}
          </ul>

          {/* Grand écran : tableau */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card xl:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Commande</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Paiement</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-page/60">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-semibold">#{r.id}</p>
                      <p className="text-xs text-muted">{fmtDate(r.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[22ch] truncate font-medium">{r.customer ?? "Client invité"}</p>
                      <p className="text-xs text-muted">{r.phone ?? r.email ?? ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold">{formatPrice(r.total, r.currency)}</td>
                    <td className="px-4 py-3"><StatusPill r={r} /></td>
                    <td className="max-w-[34ch] px-4 py-3"><PaymentInfo r={r} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><RowActions r={r} a={actions} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {list.data && <Pager page={list.data.meta.current_page} last={list.data.meta.last_page} onChange={setPage} />}

      {markFor && markOrder && (
        <MarkPaidDialog key={markFor.id} order={markOrder} pending={markPaid.isPending} error={markError}
          onSubmit={(payload) => markPaid.mutate({ id: markFor.id, payload, hadAnomaly: Boolean(markFor.anomaly) })} onClose={() => setMarkFor(null)} />
      )}
      {reasonFor && (
        <ReasonDialog key={`${reasonFor.kind}-${reasonFor.row.id}`} kind={reasonFor.kind} row={reasonFor.row} pending={reasonAction.isPending} error={reasonError}
          onSubmit={(text) => { setReasonError(""); reasonAction.mutate({ kind: reasonFor.kind, row: reasonFor.row, text }) }} onClose={() => setReasonFor(null)} />
      )}
      {historyFor && <HistoryDrawer key={historyFor.id} row={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}