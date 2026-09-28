import { useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { statusBadgeClass } from "../../lib/orderStatus"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import type { AdminOrder } from "../../types"

export default function AdminOrdersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
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
              {data.data.map((o) => (
                <tr key={o.id}>
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
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status !== "paid" && (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}