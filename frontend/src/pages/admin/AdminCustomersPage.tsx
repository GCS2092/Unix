import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { shopApi, type CustomerRow } from "../../api/shop"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { saveBlob } from "../../lib/download"
import { statusBadgeClass } from "../../lib/orderStatus"
import { adminScopeOf } from "../../lib/adminPaths"
import { toast } from "../../stores/toastStore"
import { useAuthStore } from "../../stores/authStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import Button from "../../components/Button"

const field = "min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function Detail({ ckey, onClose }: { ckey: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const locale = fr ? "fr-FR" : "en-US"
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const isSuper = adminScopeOf(me) === "super"
  const [body, setBody] = useState("")
  const key = ["admin-customer", ckey]

  const q = useQuery({ queryKey: key, queryFn: async () => (await shopApi.customer(ckey)).data.data, staleTime: 0 })
  const add = useMutation({
    mutationFn: () => shopApi.addCustomerNote(ckey, body.trim()),
    onSuccess: () => { setBody(""); void qc.invalidateQueries({ queryKey: key }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const del = useMutation({
    mutationFn: (id: number) => shopApi.deleteCustomerNote(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (q.isLoading) return <LoadingState />
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  const c = q.data
  const newOrder = `/admin/boutique/commandes/nouvelle?${new URLSearchParams({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "" }).toString()}`

  return (
    <section className="mb-6 space-y-4 rounded-card border border-primary/30 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{c.name ?? c.email ?? c.phone}</h2>
          <p className="text-sm text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
          {c.account && (
            <p className="mt-1 text-xs text-muted">
              {L("Compte client", "Customer account")}{c.account.is_student ? ` · ${L("étudiant", "student")}` : ""}{c.account.is_blocked ? ` · ${L("bloqué", "blocked")}` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={newOrder} className="flex min-h-[40px] items-center rounded-lg bg-primary px-3 text-sm font-semibold text-white">{L("Nouvelle commande", "New order")}</Link>
          <button type="button" onClick={onClose} className="min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-muted hover:text-ink">{L("Fermer", "Close")}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [L("Commandes", "Orders"), String(c.orders_count)],
          [L("Payées", "Paid"), String(c.paid_count)],
          [L("Total dépensé", "Total spent"), formatPrice(c.spent)],
          [L("Panier moyen", "Average basket"), formatPrice(c.avg_basket)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-lg bg-page p-3"><p className="text-xs text-muted">{k}</p><p className="money mt-0.5 text-sm font-bold min-[400px]:text-base">{v}</p></div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{L("Commandes", "Orders")}</h3>
        <ul className="divide-y divide-line text-sm">
          {c.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link to={`/admin/boutique/commandes?q=${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{o.public_ref ?? `#${o.id}`}</Link>
              <span className="text-xs text-muted">{o.created_at ? new Date(o.created_at).toLocaleDateString(locale) : ""}{o.source ? ` · ${o.source}` : ""}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted">{formatPrice(o.total, o.currency)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(o.status)}`}>{t(`status.${o.status}`, { defaultValue: o.status })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {c.addresses.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{L("Adresses enregistrées", "Saved addresses")}</h3>
          <ul className="space-y-1 text-sm text-muted">
            {c.addresses.map((a) => (
              <li key={a.id}>{[a.label || a.recipient_name, a.address, a.district, a.city].filter(Boolean).join(", ")}{a.is_default ? ` (${L("par défaut", "default")})` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      <div data-tour="cu-notes">
        <h3 className="mb-2 text-sm font-semibold">{L("Notes sur le client", "Customer notes")}</h3>
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate() }} className="flex flex-col gap-2 sm:flex-row">
          <textarea rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className={`${field} resize-none text-sm`}
            placeholder={L("Ex. préfère être livré le soir, bon payeur…", "E.g. prefers evening delivery, reliable payer…")} />
          <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()} className="sm:self-start">{L("Ajouter", "Add")}</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {c.notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-line break-words">{n.body}</p>
                {(isSuper || n.user_id === me?.id) && (
                  <button type="button" onClick={() => del.mutate(n.id)} className="shrink-0 text-xs font-semibold text-danger hover:underline">{L("Supprimer", "Delete")}</button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{[n.author, n.created_at ? new Date(n.created_at).toLocaleString(locale) : ""].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function AdminCustomersPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const locale = fr ? "fr-FR" : "en-US"
  const [params, setParams] = useSearchParams()
  const selected = params.get("key") ?? ""
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState("spent")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const list = useQuery({
    queryKey: ["admin-customers", page, q, sort],
    queryFn: async () => (await shopApi.customers(page, { q, sort })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  function open(r: CustomerRow) {
    setParams({ key: r.key }, { replace: true })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function exportCsv() {
    setExporting(true)
    try {
      saveBlob((await shopApi.exportCustomers({ q, sort })).data, `clients-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const rows = list.data?.data ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{L("Clients", "Customers")} {list.data && <span className="text-muted">({list.data.meta.total})</span>}</h1>
        <Button variant="secondary" data-tour="cu-export" loading={exporting} onClick={() => void exportCsv()}>{L("Exporter en CSV", "Export CSV")}</Button>
      </div>

      {selected && <Detail key={selected} ckey={selected} onClose={() => setParams({}, { replace: true })} />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input data-tour="cu-search" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={L("Nom, e-mail ou téléphone", "Name, email or phone")} className={`${field} sm:max-w-sm`} />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} aria-label={L("Trier", "Sort")} className={`${field} sm:w-auto`}>
          <option value="spent">{L("Total dépensé", "Total spent")}</option>
          <option value="orders">{L("Nombre de commandes", "Order count")}</option>
          <option value="recent">{L("Dernière commande", "Latest order")}</option>
          <option value="name">{L("Nom (A–Z)", "Name (A–Z)")}</option>
        </select>
      </div>

      {list.isLoading && <LoadingState />}
      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState message={L("Aucun client pour le moment.", "No customers yet.")} />}

      {rows.length > 0 && (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => open(r)} className="w-full rounded-card border border-line bg-surface p-3.5 text-left shadow-card transition active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.name ?? "—"}</p>
                    <p className="truncate text-xs text-muted">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                  {r.user_id ? <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{L("compte", "account")}</span> : null}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-page p-2.5 text-center text-xs">
                  <div className="min-w-0"><dt className="text-muted">{L("Commandes", "Orders")}</dt><dd className="mt-0.5 font-bold">{r.orders_count}</dd></div>
                  <div className="min-w-0"><dt className="text-muted">{L("Dépensé", "Spent")}</dt><dd className="money mt-0.5 text-xs font-bold min-[400px]:text-sm">{formatPrice(r.spent)}</dd></div>
                  <div className="min-w-0"><dt className="text-muted">{L("Dernière", "Latest")}</dt><dd className="mt-0.5 font-bold">{r.last_order_at ? new Date(r.last_order_at).toLocaleDateString(locale) : "—"}</dd></div>
                </dl>
              </button>
            </li>
          ))}
        </ul>
        <div data-tour="cu-list" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{L("Client", "Customer")}</th>
                <th className="px-4 py-3 text-right font-medium">{L("Commandes", "Orders")}</th>
                <th className="px-4 py-3 text-right font-medium">{L("Total dépensé", "Total spent")}</th>
                <th className="px-4 py-3 text-right font-medium">{L("Panier moyen", "Avg basket")}</th>
                <th className="px-4 py-3 font-medium">{L("Dernière commande", "Latest order")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key} onClick={() => open(r)} className="cursor-pointer hover:bg-page">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name ?? "—"}{r.user_id ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{L("compte", "account")}</span> : null}</p>
                    <p className="text-xs text-muted">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{r.orders_count}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(r.spent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatPrice(r.avg_basket)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{r.last_order_at ? new Date(r.last_order_at).toLocaleDateString(locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {list.data && <Pagination meta={list.data.meta} onChange={setPage} />}
    </div>
  )
}




