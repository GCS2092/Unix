import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { statusBadgeClass } from "../../lib/orderStatus"
import { fulfillmentLabelKey, fulfillmentSteps } from "../../lib/fulfillment"
import { toast } from "../../stores/toastStore"
import { confirmAction } from "../../stores/confirmStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import InvoiceButton from "../../components/InvoiceButton"
import type { AdminOrder } from "../../types"

/* ---------- Filtres rapides ---------- */

type ChipId = "" | "to_process" | "today" | "pending" | "paid" | "failed" | "cancelled"
const QUICK_CHIPS: ChipId[] = ["to_process", "today"]

const CHIPS: { id: ChipId; label: string; countKey: string; tone?: string }[] = [
  { id: "", label: "Toutes", countKey: "all" },
  { id: "to_process", label: "À traiter", countKey: "to_process", tone: "text-accent" },
  { id: "today", label: "Aujourd'hui", countKey: "today" },
  { id: "pending", label: "En attente", countKey: "pending" },
  { id: "paid", label: "Payées", countKey: "paid" },
  { id: "failed", label: "Échouées", countKey: "failed", tone: "text-danger" },
  { id: "cancelled", label: "Annulées", countKey: "cancelled" },
]

/* ---------- Helpers ---------- */

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
}

function Actions({ o, expanded, toggle, h }: { o: AdminOrder; expanded: boolean; toggle: () => void; h: Handlers }) {
  const { t } = useTranslation()
  const { next } = nextStepOf(o)
  const canMarkPaid = o.status === "pending" || o.status === "failed"
  const canCancel = o.status === "pending" || o.status === "failed" || o.status === "paid"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" aria-expanded={expanded} onClick={toggle}>
        {expanded ? t("admin.hide_details") : t("admin.details")}
      </Button>
      {next && (
        <Button size="sm" variant="ghost" disabled={h.busy} onClick={() => h.setStatus(o, next)}>
          {t("fulfillment.advance", { label: t(fulfillmentLabelKey(next, o.delivery_method)) })}
        </Button>
      )}
      {canMarkPaid && (
        <Button size="sm" variant="ghost" disabled={h.busy} onClick={() => h.markPaid(o)}>
          {t("admin.mark_paid")}
        </Button>
      )}
      {o.status === "paid" && <InvoiceButton orderId={o.id} size="sm" />}
      {canCancel && (
        <Button size="sm" variant="ghost" className="text-danger" disabled={h.busy} onClick={() => h.cancel(o)}>
          {t("admin.cancel_order", { defaultValue: "Annuler la commande" })}
        </Button>
      )}
    </div>
  )
}

function Details({ o, h }: { o: AdminOrder; h: Handlers }) {
  const { t } = useTranslation()
  const { steps } = nextStepOf(o)
  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("admin.phone")}>
          {o.phone && <a href={`tel:${o.phone}`} className="text-primary hover:underline">{o.phone}</a>}
        </Field>
        <Field label={t("admin.delivery")}>
          {o.delivery_method && t(`admin.method_${o.delivery_method}`, { defaultValue: o.delivery_method })}
        </Field>
        <Field label={t("admin.zone")}>
          {o.delivery_zone && t(`checkout.zone_${o.delivery_zone}`, { defaultValue: o.delivery_zone })}
        </Field>
        <Field label={t("admin.address")}>{[o.address, o.district, o.city].filter(Boolean).join(", ")}</Field>
        <Field label={t("admin.landmark")}>{o.landmark}</Field>
        <Field label={t("admin.note")}>{o.note}</Field>
        <Field label={t("admin.subtotal")}>{o.subtotal !== undefined && formatPrice(o.subtotal, o.currency)}</Field>
        <Field label={t("admin.delivery_fee")}>{o.delivery_fee !== undefined && formatPrice(o.delivery_fee, o.currency)}</Field>
      </dl>

      {steps.length > 0 && (
        <label className="mt-4 block text-sm">
          <span className="text-muted">{t("fulfillment.update")}</span>
          <select
            value={o.fulfillment_status ?? ""}
            onChange={(e) => h.setStatus(o, e.target.value)}
            disabled={h.busy}
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 sm:w-auto"
          >
            <option value="" disabled>—</option>
            {steps.map((s) => (
              <option key={s} value={s}>{t(fulfillmentLabelKey(s, o.delivery_method))}</option>
            ))}
          </select>
        </label>
      )}

      {o.items && o.items.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="text-muted">{t("admin.items")}</p>
          <ul className="mt-1 space-y-1">
            {o.items.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span className="min-w-0 truncate">
                  {line.item?.title ?? line.item?.name ?? t("orders.item")} × {line.quantity}
                </span>
                <span className="whitespace-nowrap text-muted">{formatPrice(line.line_total, o.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to={`/admin/commandes/${o.id}/bon`} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
        {t("admin.print_note", { defaultValue: "Imprimer le bon de livraison" })}
      </Link>
    </>
  )
}

function FragmentRows({ children, expanded, details }: { children: ReactNode; expanded: boolean; details: ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
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
  }

  const markPaid = useMutation({
    mutationFn: (order: AdminOrder) => adminApi.markPaid(order.id),
    onSuccess: async (_r, order) => {
      setActionError(null)
      toast.success(t("admin.paid_done", { defaultValue: "Commande #{{id}} marquée payée.", id: order.id }))
      await refreshAll()
    },
    onError: (e) => setActionError(getErrorMessage(e)),
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

  async function askMarkPaid(order: AdminOrder) {
    const { ok } = await confirmAction({
      title: `Marquer la commande #${order.id} comme payée ?`,
      message: `Montant : ${formatPrice(order.total, order.currency)}. Le stock sera mis à jour et le client recevra l'e-mail de confirmation avec sa facture.`,
      confirmLabel: "Marquer payée",
    })
    if (ok) {
      setActionError(null)
      markPaid.mutate(order)
    }
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

  const handlers: Handlers = {
    busy: markPaid.isPending || setFulfillment.isPending || cancelOrder.isPending || bulk.isPending,
    markPaid: (order) => void askMarkPaid(order),
    cancel: (order) => void askCancel(order),
    setStatus: (order, s) => setFulfillment.mutate({ order, status: s }),
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

  const badge = (o: AdminOrder) => (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(o.status)}`}>
      {t(`status.${o.status}`, { defaultValue: o.status_label })}
      {o.status === "paid" && o.fulfillment_status ? ` · ${t(fulfillmentLabelKey(o.fulfillment_status, o.delivery_method))}` : ""}
    </span>
  )

  const hasFilter = Boolean(status || quick || q)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">
          {t("admin.orders")} {data && <span className="text-muted">({data.meta.total})</span>}
        </h1>
        <Button variant="secondary" loading={exporting} onClick={() => void handleExport()}>
          {t("admin.export_csv", { defaultValue: "Exporter en CSV" })}
        </Button>
      </div>

      {/* Filtres rapides */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtres">
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
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("admin.search_orders", { defaultValue: "N° de commande, nom, e-mail ou téléphone" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:max-w-sm"
        />
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
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
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
          <ul className="space-y-3 md:hidden">
            {rows.map((o) => {
              const c = customer(o)
              const expanded = open === o.id
              return (
                <li key={o.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
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
                        <span className="block font-semibold">#{o.id}</span>
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
                    <p className="whitespace-nowrap font-bold text-primary">{formatPrice(o.total, o.currency)}</p>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions o={o} expanded={expanded} toggle={() => setOpen(expanded ? null : o.id)} h={handlers} />
                  </div>
                  {expanded && <div className="mt-4 border-t border-line pt-4"><Details o={o} h={handlers} /></div>}
                </li>
              )
            })}
          </ul>

          {/* Ordinateur : tableau */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} aria-label="Tout sélectionner" />
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
                      <td className="px-4 py-3 font-medium">#{o.id}</td>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(o.created_at).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted">{c.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatPrice(o.total, o.currency)}</td>
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
    </div>
  )
}