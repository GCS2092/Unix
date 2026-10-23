import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import type { MarkPaidPayload } from "../../api/admin"
import MarkPaidDialog from "../../components/MarkPaidDialog"
import { ordersApi } from "../../api/orders"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { fulfillmentLabelKey, fulfillmentSteps } from "../../lib/fulfillment"
import { toast } from "../../stores/toastStore"
import { confirmAction } from "../../stores/confirmStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import InvoiceButton from "../../components/InvoiceButton"
import OrderNotes from "../../components/OrderNotes"
import { buttonClass } from "../../components/buttonStyles"
import type { AdminOrder } from "../../types"
import { PageHeader, Pill, StatCard, Svg } from "../../components/admin/ui"
import { inputClass } from "../../components/admin/adminStyles"

/* ---------- Filtres rapides ---------- */

type ChipId = "" | "to_process" | "today" | "pending" | "paid" | "failed" | "cancelled" | "stock_conflict"
const QUICK_CHIPS: ChipId[] = ["to_process", "today", "stock_conflict"]

const CHIPS: { id: ChipId; label: string; countKey: string; tone?: string }[] = [
  { id: "", label: "Toutes", countKey: "all" },
  { id: "to_process", label: "À traiter", countKey: "to_process", tone: "text-accent" },
  { id: "today", label: "Aujourd'hui", countKey: "today" },
  { id: "stock_conflict", label: "Conflits de stock", countKey: "stock_conflict", tone: "text-danger" },
  { id: "pending", label: "En attente", countKey: "pending" },
  { id: "paid", label: "Payées", countKey: "paid" },
  { id: "failed", label: "Échouées", countKey: "failed", tone: "text-danger" },
  { id: "cancelled", label: "Annulées", countKey: "cancelled" },
]

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info"> = {
  paid: "success",
  pending: "warn",
  failed: "danger",
  cancelled: "info",
}

const I_BOX = "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"
const I_CAL = "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"
const I_CLOCK = "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z"
const I_ALERT = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
const I_SEARCH = "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"

/* ---------- Helpers ---------- */

const refOf = (o: AdminOrder) => (o as unknown as { public_ref?: string | null }).public_ref ?? null

const isConflict = (o: AdminOrder) => Boolean((o as unknown as { stock_conflict?: boolean }).stock_conflict)

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  )
}

function nextStepOf(o: AdminOrder) {
  const steps = o.status === "paid" ? fulfillmentSteps(o.delivery_method) : []
  const i = steps.findIndex((s) => s === o.fulfillment_status)
  const next = steps.length === 0 ? null : i === -1 ? steps[0] : i < steps.length - 1 ? steps[i + 1] : null
  return { steps, next }
}

interface Handlers {
  busy: boolean
  markPaid: (o: AdminOrder) => void
  cancel: (o: AdminOrder) => void
  setStatus: (o: AdminOrder, status: string) => void
  resolveConflict: (o: AdminOrder) => void
  resend: (o: AdminOrder) => void
}

function Actions({ o, expanded, toggle, h }: { o: AdminOrder; expanded: boolean; toggle: () => void; h: Handlers }) {
  const { t } = useTranslation()
  const { next } = nextStepOf(o)
  const canMarkPaid = o.status === "pending" || o.status === "failed"
  const canCancel = o.status === "pending" || o.status === "failed" || o.status === "paid"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" data-tour="ord-details" aria-expanded={expanded} onClick={toggle}>
        {expanded ? t("admin.hide_details") : t("admin.details")}
      </Button>
      {next && (
        <Button size="sm" variant="ghost" data-tour="ord-next" disabled={h.busy} onClick={() => h.setStatus(o, next)}>
          {t("fulfillment.advance", { label: t(fulfillmentLabelKey(next, o.delivery_method)) })}
        </Button>
      )}
      {canMarkPaid && (
        <Button size="sm" variant="ghost" data-tour="ord-markpaid" disabled={h.busy} onClick={() => h.markPaid(o)}>
          {t("admin.mark_paid")}
        </Button>
      )}
      {o.status === "paid" && <InvoiceButton orderId={o.id} size="sm" />}
      {o.status === "paid" && (
        <Button size="sm" variant="ghost" disabled={h.busy} onClick={() => h.resend(o)}>
          Renvoyer l'e-mail
        </Button>
      )}
      {isConflict(o) && (
        <Button size="sm" variant="secondary" disabled={h.busy} onClick={() => h.resolveConflict(o)}>
          Marquer le conflit traité
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="ghost" className="text-danger" disabled={h.busy} onClick={() => h.cancel(o)}>
          {t("admin.cancel_order", { defaultValue: "Annuler la commande" })}
        </Button>
      )}
    </div>
  )
}

const I_USER = "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
const I_TRUCK = "M3 7h11v9H3zM14 10h4l3 3v3h-7"
const I_CARD = "M3 7h18v12H3zM3 11h18M7 15h3"

type DetailTab = "items" | "track" | "customer" | "delivery" | "payment" | "notes"

function Details({ o, h }: { o: AdminOrder; h: Handlers }) {
  const { t } = useTranslation()
  const { steps } = nextStepOf(o)
  const currentIdx = steps.findIndex((s) => s === o.fulfillment_status)
  const address = [o.address, o.district, o.city].filter(Boolean).join(", ")
  const itemCount = o.items?.length ?? 0

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "items", label: `Articles${itemCount > 0 ? ` (${itemCount})` : ""}` },
    ...(steps.length > 0 ? [{ id: "track" as const, label: "Suivi" }] : []),
    { id: "customer", label: "Client" },
    { id: "delivery", label: "Livraison" },
    { id: "payment", label: "Paiement" },
    { id: "notes", label: "Notes" },
  ]
  const [tab, setTab] = useState<DetailTab>("items")
  const idx = Math.max(0, tabs.findIndex((x) => x.id === tab))
  const go = (n: number) => setTab(tabs[Math.min(tabs.length - 1, Math.max(0, n))].id)

  const rows = (list: [string, ReactNode][]) => {
    const shown = list.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false)
    if (shown.length === 0) return <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-muted">Aucune information renseignée.</p>
    return (
      <dl className="grid gap-x-6 gap-y-4 text-sm min-[520px]:grid-cols-2">
        {shown.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-1 break-words text-base font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="space-y-4">
      {isConflict(o) && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          <Svg d={I_ALERT} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Cette commande est payée, mais le stock manquait au moment du paiement. Rembourse le client ou livre-le après réapprovisionnement, puis marque le conflit traité.</span>
        </p>
      )}

      <div role="tablist" aria-label="Détails de la commande" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((x, i) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${
              tab === x.id ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${tab === x.id ? "bg-white/25" : "bg-line"}`}>{i + 1}</span>
            {x.label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-up rounded-xl border border-line bg-surface p-4 sm:p-5">
        {tab === "items" && (
          itemCount === 0 ? (
            <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-muted">Aucun article.</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {o.items!.map((line) => (
                  <li key={line.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                    <span className="min-w-0">
                      <span className="block break-words text-base font-medium">{line.item?.title ?? line.item?.name ?? t("orders.item")}</span>
                      <span className="text-sm text-muted">Quantité : {line.quantity}</span>
                    </span>
                    <span className="money shrink-0 text-right text-base font-semibold">{formatPrice(line.line_total, o.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-2 rounded-xl bg-page p-4 text-sm">
                {o.subtotal !== undefined && (
                  <p className="flex justify-between gap-3 text-muted"><span>{t("admin.subtotal")}</span><span className="money">{formatPrice(o.subtotal, o.currency)}</span></p>
                )}
                {o.delivery_fee !== undefined && (
                  <p className="flex justify-between gap-3 text-muted"><span>{t("admin.delivery_fee")}</span><span className="money">{formatPrice(o.delivery_fee, o.currency)}</span></p>
                )}
                <p className="flex justify-between gap-3 border-t border-line pt-2 text-lg font-extrabold">
                  <span>{t("admin.col_total")}</span><span className="money text-primary">{formatPrice(o.total, o.currency)}</span>
                </p>
              </div>
            </>
          )
        )}

        {tab === "track" && (
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const done = currentIdx > i
              const cur = currentIdx === i
              return (
                <li key={s}>
                  <button
                    type="button" disabled={h.busy || cur} aria-current={cur ? "step" : undefined} onClick={() => h.setStatus(o, s)}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition active:scale-[0.99] disabled:opacity-100 ${
                      cur ? "border-primary bg-primary text-white shadow-sm"
                      : done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cur ? "bg-white/25" : done ? "bg-emerald-500/20" : "bg-line"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="flex-1">{t(fulfillmentLabelKey(s, o.delivery_method))}</span>
                    {cur && <span className="text-xs font-medium opacity-80">En cours</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {tab === "customer" && rows([
          [t("admin.phone"), o.phone && <a href={`tel:${o.phone}`} className="text-primary hover:underline">{o.phone}</a>],
          [t("admin.note"), o.note],
        ])}

        {tab === "delivery" && rows([
          [t("admin.delivery"), o.delivery_method && t(`admin.method_${o.delivery_method}`, { defaultValue: o.delivery_method })],
          [t("admin.zone"), o.delivery_zone && t(`checkout.zone_${o.delivery_zone}`, { defaultValue: o.delivery_zone })],
          [t("admin.address"), address],
          [t("admin.landmark"), o.landmark],
        ])}

        {tab === "payment" && rows([
          [t("admin.pay_method"), o.payment_method && t(`admin.pay_method_${o.payment_method}`, { defaultValue: o.payment_method })],
          [t("admin.pay_reference"), o.payment_reference],
          [t("admin.pay_source"), o.payment_source && t(`admin.pay_source_${o.payment_source}`, { defaultValue: o.payment_source })],
          [t("admin.pay_paid_by"), o.paid_by_name],
        ])}

        {tab === "notes" && (
          <div className="space-y-4">
            <OrderNotes orderId={o.id} />
            <Link to={`/admin/boutique/commandes/${o.id}/bon`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline">
              {t("admin.print_note", { defaultValue: "Imprimer le bon de livraison" })}
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={idx === 0} onClick={() => go(idx - 1)} className="min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-40">
          ← Précédent
        </button>
        <span className="text-xs font-semibold text-muted">{idx + 1} / {tabs.length}</span>
        <button type="button" disabled={idx === tabs.length - 1} onClick={() => go(idx + 1)} className="min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-40">
          Suivant →
        </button>
      </div>
    </div>
  )
}
function FragmentRows({ children, expanded, details }: { children: ReactNode; expanded: boolean; details: ReactNode }) {
  return (
    <>
      <tr className="align-top transition hover:bg-page/60">{children}</tr>
      {expanded && (
        <tr className="bg-page/60">
          <td colSpan={7} className="px-4 py-4">{details}</td>
        </tr>
      )}
    </>
  )
}

/* ---------- Page ---------- */

export default function AdminOrdersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()

  // Les filtres vivent dans l'URL : on les retrouve en revenant sur la page ou en rechargeant
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get("page")) || 1)
  const status = params.get("status") ?? ""
  const quick = params.get("quick") ?? ""
  const q = params.get("q") ?? ""
  const activeChip = (quick || status) as ChipId

  const [input, setInput] = useState(q)
  const [open, setOpen] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [payOrder, setPayOrder] = useState<AdminOrder | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const patch = useCallback((next: Record<string, string | undefined>) => {
    setSelected([])
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(next)) {
        if (v) p.set(k, v)
        else p.delete(k)
      }
      return p
    }, { replace: true })
  }, [setParams])

  useEffect(() => {
    const id = setTimeout(() => {
      if (input.trim() !== q) patch({ q: input.trim() || undefined, page: undefined })
    }, 350)
    return () => clearTimeout(id)
  }, [input, q, patch])

  function selectChip(id: ChipId) {
    patch({
      status: id && !QUICK_CHIPS.includes(id) ? id : undefined,
      quick: id && QUICK_CHIPS.includes(id) ? id : undefined,
      page: undefined,
    })
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-orders", page, status, quick, q],
    queryFn: async () => (await adminApi.orders(page, { status, quick, q })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
    await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })
    await queryClient.invalidateQueries({ queryKey: ["admin-nav-badge"] })
  }

  const markPaid = useMutation({
    mutationFn: ({ order, payload }: { order: AdminOrder; payload: MarkPaidPayload }) => adminApi.markPaid(order.id, payload),
    onSuccess: async (_r, { order }) => {
      setPayOrder(null)
      setPayError(null)
      setActionError(null)
      toast.success(t("admin.paid_done", { defaultValue: "Commande #{{id}} marqu\u00e9e pay\u00e9e.", id: order.id }))
      await refreshAll()
    },
    onError: (e) => setPayError(getErrorMessage(e)),
  })

  const cancelOrder = useMutation({
    mutationFn: ({ order, reason }: { order: AdminOrder; reason: string }) => adminApi.cancelOrder(order.id, reason || undefined),
    onSuccess: async (_r, { order }) => {
      setActionError(null)
      toast.success(t("admin.cancel_done", { defaultValue: "Commande #{{id}} annulée.", id: order.id }))
      await refreshAll()
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const setFulfillment = useMutation({
    mutationFn: ({ order, status: s }: { order: AdminOrder; status: string }) => adminApi.updateFulfillment(order.id, s),
    onSuccess: async () => {
      setActionError(null)
      toast.success(t("admin.saved", { defaultValue: "Enregistré" }))
      await refreshAll()
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const bulk = useMutation({
    mutationFn: (ids: number[]) => adminApi.bulkAdvance(ids),
    onSuccess: async (res) => {
      const { updated, skipped } = res.data.data
      setActionError(null)
      setSelected([])
      toast.success(
        skipped > 0
          ? `${updated} commande(s) avancée(s), ${skipped} ignorée(s).`
          : `${updated} commande(s) avancée(s).`,
      )
      await refreshAll()
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  function askMarkPaid(order: AdminOrder) {
    setPayError(null)
    setPayOrder(order)
  }

  async function askCancel(order: AdminOrder) {
    const wasPaid = order.status === "paid"
    const { ok, reason } = await confirmAction({
      title: `Annuler la commande #${order.id} ?`,
      message: wasPaid
        ? "La commande est déjà payée : le stock sera remis en vente, mais le remboursement du client reste à faire manuellement chez le prestataire de paiement. Cette action est définitive."
        : "La commande sera marquée comme annulée. Cette action est définitive.",
      confirmLabel: "Annuler la commande",
      cancelLabel: "Garder la commande",
      reasonLabel: "Motif (facultatif)",
      danger: true,
    })
    if (ok) {
      setActionError(null)
      cancelOrder.mutate({ order, reason })
    }
  }

  const resend = useMutation({
    mutationFn: (order: AdminOrder) => ordersApi.adminResendConfirmation(order.id),
    onSuccess: (res) => toast.success(`E-mail de confirmation envoy\u00e9 \u00e0 ${res.data.data.sent_to}.`),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const resolveConflict = useMutation({
    mutationFn: (order: AdminOrder) => adminApi.resolveStockConflict(order.id),
    onSuccess: async (_r, order) => {
      setActionError(null)
      toast.success(`Conflit de la commande #${order.id} marqué traité.`)
      await refreshAll()
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] })
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  async function askResolve(order: AdminOrder) {
    const { ok } = await confirmAction({
      title: `Marquer le conflit de la commande #${order.id} comme traité ?`,
      message: "Confirme que tu as rembourse le client ou que tu le livreras apres reapprovisionnement. La commande quittera la liste des conflits.",
      confirmLabel: "Marquer traité",
    })
    if (ok) {
      setActionError(null)
      resolveConflict.mutate(order)
    }
  }

  async function askResend(order: AdminOrder) {
    const { ok } = await confirmAction({
      title: `Renvoyer l'e-mail de confirmation de la commande ${refOf(order) ?? "#" + order.id} ?`,
      message: "Le client recevra de nouveau l'e-mail de confirmation avec sa facture.",
      confirmLabel: "Renvoyer",
    })
    if (ok) resend.mutate(order)
  }

  const handlers: Handlers = {
    busy: markPaid.isPending || setFulfillment.isPending || cancelOrder.isPending || bulk.isPending || resolveConflict.isPending,
    markPaid: (order) => void askMarkPaid(order),
    cancel: (order) => void askCancel(order),
    setStatus: (order, s) => setFulfillment.mutate({ order, status: s }),
    resolveConflict: (order) => void askResolve(order),
    resend: (order) => void askResend(order),
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminApi.exportOrders({ status, quick, q })
      saveBlob(res.data, `commandes-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.data ?? []
  const counts = data?.meta.counts
  const allSelected = rows.length > 0 && rows.every((o) => selected.includes(o.id))
  const advanceable = rows.filter((o) => selected.includes(o.id) && nextStepOf(o).next !== null)

  function toggleOne(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((o) => o.id))
  }

  const customer = (o: AdminOrder) =>
    o.user
      ? { name: o.user.name, email: o.user.email }
      : { name: o.guest_name ?? t("admin.guest"), email: o.guest_email ?? "—" }

  const baseBadge = (o: AdminOrder) => (
    <Pill tone={STATUS_TONE[o.status] ?? "info"} dot>
      {`${t(`status.${o.status}`, { defaultValue: o.status_label })}${o.status === "paid" && o.fulfillment_status ? ` · ${t(fulfillmentLabelKey(o.fulfillment_status, o.delivery_method))}` : ""}`}
    </Pill>
  )

  const badge = (o: AdminOrder): ReactNode => (
    <span className="inline-flex flex-wrap items-center gap-1">
      {baseBadge(o)}
      {isConflict(o) && <Pill tone="danger" dot>Sans stock</Pill>}
      {(o.status === "pending" || o.status === "failed") && o.payment_claimed_at && <Pill tone="warn" dot>Paiement déclaré</Pill>}
    </span>
  )

  const hasFilter = Boolean(status || quick || q)

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle={data ? `${data.meta.total} commande(s)${hasFilter ? " correspondant aux filtres" : ""}` : "Suis les commandes, valide les paiements et fais avancer les livraisons."}
        actions={
          <>
            <Link to="/admin/boutique/commandes/nouvelle" data-tour="ord-new" className={buttonClass()}>{t("admin.new_order", { defaultValue: "Nouvelle commande" })}</Link>
            <Button variant="secondary" data-tour="ord-export" loading={exporting} onClick={() => void handleExport()}>
              {t("admin.export_csv", { defaultValue: "Exporter en CSV" })}
            </Button>
          </>
        }
      />

      {counts && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="À traiter" hint="payées, à préparer ou livrer" value={counts.to_process} icon={I_BOX} tone="warn" active={activeChip === "to_process"} onClick={() => selectChip(activeChip === "to_process" ? "" : "to_process")} />
          <StatCard label="Aujourd'hui" hint="commandes créées" value={counts.today} icon={I_CAL} tone="info" active={activeChip === "today"} onClick={() => selectChip(activeChip === "today" ? "" : "today")} />
          <StatCard label="En attente de paiement" value={counts.pending} icon={I_CLOCK} tone="neutral" active={activeChip === "pending"} onClick={() => selectChip(activeChip === "pending" ? "" : "pending")} />
          <StatCard label="Conflits de stock" hint="payées sans stock" value={counts.stock_conflict ?? 0} icon={I_ALERT} tone="danger" active={activeChip === "stock_conflict"} onClick={() => selectChip(activeChip === "stock_conflict" ? "" : "stock_conflict")} />
        </div>
      )}

      {/* Filtres rapides */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" data-tour="ord-chips" aria-label="Filtres">
        {CHIPS.map((c) => {
          const active = activeChip === c.id
          const n = counts ? (counts as unknown as Record<string, number>)[c.countKey] : undefined
          return (
            <button
              key={c.id || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => selectChip(c.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {c.label}
              {n !== undefined && (
                <span className={`ml-1.5 text-xs font-semibold ${active ? "text-white/80" : n > 0 && c.tone ? c.tone : ""}`}>{n}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"><Svg d={I_SEARCH} className="h-4 w-4" /></span>
          <input
            type="search" data-tour="ord-search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("admin.search_orders", { defaultValue: "N° de commande, nom, e-mail ou téléphone" })}
            className={`${inputClass} pl-9`}
          />
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={() => { setInput(""); patch({ status: undefined, quick: undefined, q: undefined, page: undefined }) }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Actions groupées */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary/10 px-4 py-2 text-sm shadow-card backdrop-blur">
          <span className="font-semibold">{selected.length} sélectionnée(s)</span>
          <Button
            size="sm"
            loading={bulk.isPending}
            disabled={advanceable.length === 0}
            onClick={() => bulk.mutate(advanceable.map((o) => o.id))}
          >
            Passer {advanceable.length} commande(s) à l'étape suivante
          </Button>
          <button type="button" onClick={() => setSelected([])} className="font-semibold text-muted hover:text-ink">
            Tout désélectionner
          </button>
          {advanceable.length < selected.length && (
            <span className="text-xs text-muted">
              {selected.length - advanceable.length} ne peuvent pas avancer (non payée, sans suivi ou déjà livrée).
            </span>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Fermer" className="font-bold">×</button>
        </p>
      )}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && rows.length === 0 && (
        <EmptyState message={hasFilter ? "Aucune commande ne correspond à ces filtres." : t("admin.no_orders")} />
      )}

      {data && rows.length > 0 && (
        <>
          {/* Mobile : cartes */}
          <ul data-tour="ord-list" className="grid gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((o) => {
              const c = customer(o)
              const expanded = open === o.id
              return (
                <li key={o.id} className="min-w-0 self-start rounded-card border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={selected.includes(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Sélectionner la commande ${o.id}`}
                      />
                      <span>
                        <span className="block font-mono text-sm font-semibold">{refOf(o) ?? `#${o.id}`}</span>
                        <span className="block text-xs text-muted">{new Date(o.created_at).toLocaleDateString(locale)}</span>
                      </span>
                    </label>
                    {badge(o)}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">{c.email}</p>
                    </div>
                    <p className="money shrink-0 text-right font-bold text-primary">{formatPrice(o.total, o.currency)}</p>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions o={o} expanded={expanded} toggle={() => setOpen(expanded ? null : o.id)} h={handlers} />
                  </div>
                  {expanded && <div className="mt-4 border-t border-line bg-page/60 -mx-4 -mb-4 rounded-b-card p-4"><Details o={o} h={handlers} /></div>}
                </li>
              )
            })}
          </ul>

          {/* Ordinateur : tableau */}
          <div data-tour="ord-list" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} data-tour="ord-select" aria-label="Tout sélectionner" />
                  </th>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_date")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_customer")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_total")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("admin.col_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => {
                  const c = customer(o)
                  const expanded = open === o.id
                  return (
                    <FragmentRows key={o.id} expanded={expanded} details={<Details o={o} h={handlers} />}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.includes(o.id)}
                          onChange={() => toggleOne(o.id)}
                          aria-label={`Sélectionner la commande ${o.id}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium"><span className="block font-mono text-xs">{refOf(o) ?? `#${o.id}`}</span><span className="block text-xs text-muted">#{o.id}</span></td>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(o.created_at).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted">{c.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold">{formatPrice(o.total, o.currency)}</td>
                      <td className="px-4 py-3">{badge(o)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Actions o={o} expanded={expanded} toggle={() => setOpen(expanded ? null : o.id)} h={handlers} />
                        </div>
                      </td>
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && <Pagination meta={data.meta} onChange={(p) => patch({ page: p > 1 ? String(p) : undefined })} />}

      <MarkPaidDialog
        key={payOrder?.id ?? "none"}
        order={payOrder}
        pending={markPaid.isPending}
        error={payError}
        onClose={() => setPayOrder(null)}
        onSubmit={(payload) => payOrder && markPaid.mutate({ order: payOrder, payload })}
      />
    </div>
  )
}


