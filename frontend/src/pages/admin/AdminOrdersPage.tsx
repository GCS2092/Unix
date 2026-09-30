import { Fragment, useState, type ReactNode } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { statusBadgeClass } from "../../lib/orderStatus"
import { fulfillmentLabelKey, fulfillmentSteps } from "../../lib/fulfillment"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import type { AdminOrder } from "../../types"

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

export default function AdminOrdersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-orders", page],
    queryFn: async () => (await adminApi.orders(page)).data,
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

  function handleMarkPaid(order: AdminOrder) {
    const ok = window.confirm(
      t("admin.confirm_paid", { id: order.id, amount: formatPrice(order.total, order.currency) }),
    )
    if (ok) {
      setActionError(null)
      markPaid.mutate(order)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("admin.orders")} {data && <span className="text-muted">({data.meta.total})</span>}</h2>
      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_orders")} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
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
                const expanded = open === o.id
                const canMarkPaid = o.status === "pending" || o.status === "failed"
                const steps = o.status === "paid" ? fulfillmentSteps(o.delivery_method) : []
                const stepIndex = steps.findIndex((s) => s === o.fulfillment_status)
                const nextStep =
                  steps.length === 0
                    ? null
                    : stepIndex === -1
                      ? steps[0]
                      : stepIndex < steps.length - 1
                        ? steps[stepIndex + 1]
                        : null
                return (
                  <Fragment key={o.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium">#{o.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3">
                        {o.user ? (
                          <>
                            <p className="font-medium">{o.user.name}</p>
                            <p className="text-muted">{o.user.email}</p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{o.guest_name ?? t("admin.guest")}</p>
                            <p className="text-muted">{o.guest_email ?? "—"}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPrice(o.total, o.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(o.status)}`}>
                          {t(`status.${o.status}`, { defaultValue: o.status_label })}
                          {o.status === "paid" && o.fulfillment_status ? ` · ${t(fulfillmentLabelKey(o.fulfillment_status, o.delivery_method))}` : ""}
                        </span>
                      </td>
                      <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : o.id)}
                          className="font-semibold text-muted hover:text-ink"
                        >
                          {expanded ? t("admin.hide_details") : t("admin.details")}
                        </button>
                        {nextStep && (
                          <button
                            type="button"
                            onClick={() => setFulfillment.mutate({ order: o, status: nextStep })}
                            disabled={setFulfillment.isPending}
                            className="font-semibold text-primary hover:underline disabled:opacity-60"
                          >
                            {t("fulfillment.advance", { label: t(fulfillmentLabelKey(nextStep, o.delivery_method)) })}
                          </button>
                        )}
                        {canMarkPaid && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(o)}
                            disabled={markPaid.isPending}
                            className="font-semibold text-primary hover:underline disabled:opacity-60"
                          >
                            {t("admin.mark_paid")}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-page/60">
                        <td colSpan={6} className="px-4 py-4">
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
                            <Field label={t("admin.address")}>
                              {[o.address, o.district, o.city].filter(Boolean).join(", ")}
                            </Field>
                            <Field label={t("admin.landmark")}>{o.landmark}</Field>
                            <Field label={t("admin.note")}>{o.note}</Field>
                            <Field label={t("admin.subtotal")}>
                              {o.subtotal !== undefined && formatPrice(o.subtotal, o.currency)}
                            </Field>
                            <Field label={t("admin.delivery_fee")}>
                              {o.delivery_fee !== undefined && formatPrice(o.delivery_fee, o.currency)}
                            </Field>
                          </dl>
                          {steps.length > 0 && (
                            <label className="mt-4 block text-sm">
                              <span className="text-muted">{t("fulfillment.update")}</span>
                              <select
                                value={o.fulfillment_status ?? ""}
                                onChange={(e) => setFulfillment.mutate({ order: o, status: e.target.value })}
                                disabled={setFulfillment.isPending}
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
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}