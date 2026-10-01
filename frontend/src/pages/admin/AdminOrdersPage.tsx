import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { statusBadgeClass } from "../../lib/orderStatus"
import { fulfillmentLabelKey, fulfillmentSteps } from "../../lib/fulfillment"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"
import InvoiceButton from "../../components/InvoiceButton"
import type { AdminOrder } from "../../types"

const STATUSES = ["pending", "paid", "failed"]

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
  setStatus: (o: AdminOrder, status: string) => void
}

function Actions({ o, expanded, toggle, h }: { o: AdminOrder; expanded: boolean; toggle: () => void; h: Handlers }) {
  const { t } = useTranslation()
  const { next } = nextStepOf(o)
  const canMarkPaid = o.status === "pending" || o.status === "failed"
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

export default function AdminOrdersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-orders", page, status, q],
    queryFn: async () => (await adminApi.orders(page, { status, q })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const markPaid = useMutation({
    mutationFn: (order: AdminOrder) => adminApi.markPaid(order.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const setFulfillment = useMutation({
    mutationFn: ({ order, status }: { order: AdminOrder; status: string }) => adminApi.updateFulfillment(order.id, status),
    onSuccess: () => {
      setActionError(null)
      return queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  })

  const handlers: Handlers = {
    busy: markPaid.isPending || setFulfillment.isPending,
    markPaid: (order) => {
      if (window.confirm(t("admin.confirm_paid", { id: order.id, amount: formatPrice(order.total, order.currency) }))) {
        setActionError(null)
        markPaid.mutate(order)
      }
    },
    setStatus: (order, s) => setFulfillment.mutate({ order, status: s }),
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminApi.exportOrders({ status, q })
      saveBlob(res.data, `commandes-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("admin.search_orders", { defaultValue: "N° de commande, nom, e-mail ou téléphone" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          aria-label={t("admin.col_status")}
          className="min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
        >
          <option value="">{t("admin.all_statuses", { defaultValue: "Tous les statuts" })}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`, { defaultValue: s })}</option>
          ))}
        </select>
      </div>

      {actionError && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_orders")} />}

      {data && data.data.length > 0 && (
        <>
          {/* Mobile : cartes */}
          <ul className="space-y-3 md:hidden">
            {data.data.map((o) => {
              const c = customer(o)
              const expanded = open === o.id
              return (
                <li key={o.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">#{o.id}</p>
                      <p className="text-xs text-muted">{new Date(o.created_at).toLocaleDateString(locale)}</p>
                    </div>
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
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_date")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_customer")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_total")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("admin.col_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((o) => {
                  const c = customer(o)
                  const expanded = open === o.id
                  return (
                    <FragmentRows key={o.id} expanded={expanded} details={<Details o={o} h={handlers} />}>
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
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}

function FragmentRows({ children, expanded, details }: { children: ReactNode; expanded: boolean; details: ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {expanded && (
        <tr className="bg-page/60">
          <td colSpan={6} className="px-4 py-4">{details}</td>
        </tr>
      )}
    </>
  )
}