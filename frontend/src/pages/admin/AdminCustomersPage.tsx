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
import { StatCard, Svg } from "../../components/admin/ui"
import { Avatar, Hero, SearchBox, Segmented, heroBtnGhost } from "../../components/admin/formationUi"

const I_USERS = "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"
const I_COIN = "M12 21a9 9 0 100-18 9 9 0 000 18zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"
const I_BASKET = "M6 7h12l-1 13H7L6 7zM9 7a3 3 0 016 0"
const I_DOWNLOAD = "M12 3v12M7 10l5 5 5-5M4 21h16"
const field = "min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function ago(iso: string | null | undefined, fr: boolean): string {
  if (!iso) return "—"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return fr ? "aujourd'hui" : "today"
  if (days === 1) return fr ? "hier" : "yesterday"
  if (days < 60) return fr ? `il y a ${days} j` : `${days}d ago`
  return ""
}

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
    <section className="space-y-4 rounded-card border border-primary/30 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.name ?? c.email ?? "?"} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{c.name ?? c.email ?? c.phone}</h2>
            <p className="break-words text-sm text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
            {c.account && (
              <p className="mt-0.5 text-xs text-muted">
                {L("Compte client", "Customer account")}{c.account.is_student ? ` · ${L("étudiant", "student")}` : ""}{c.account.is_blocked ? ` · ${L("bloqué", "blocked")}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={newOrder} className="flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white">{L("Nouvelle commande", "New order")}</Link>
          {c.phone && (
            <a href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^00/, "")}`} target="_blank" rel="noopener noreferrer"
              className="flex min-h-[44px] items-center rounded-lg border border-[#25D366] px-4 text-sm font-semibold text-[#0f6b4a] hover:bg-[#25D366]/10">WhatsApp</a>
          )}
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-semibold text-muted hover:text-ink">{L("Fermer", "Close")}</button>
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
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <Link to={`/admin/boutique/commandes?q=${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{o.public_ref ?? `#${o.id}`}</Link>
              <span className="text-xs text-muted">{o.created_at ? new Date(o.created_at).toLocaleDateString(locale) : ""}{o.source ? ` · ${o.source}` : ""}</span>
              <span className="flex items-center gap-2">
                <span className="money text-muted">{formatPrice(o.total, o.currency)}</span>
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
  const pageSpent = rows.reduce((n, r) => n + (r.spent ?? 0), 0)
  const pageOrders = rows.reduce((n, r) => n + (r.orders_count ?? 0), 0)
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : "—")

  const contact = (r: CustomerRow) => [r.email, r.phone].filter(Boolean).join(" · ")
  const name = (r: CustomerRow) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{r.name ?? "—"}</span>
      {r.user_id ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{L("compte", "account")}</span> : null}
    </span>
  )

  return (
    <div className="space-y-5">
      <Hero
        title={L("Clients", "Customers")}
        count={list.data?.meta.total}
        subtitle={L("Retrouvez chaque client, ses commandes et vos notes.", "Find each customer, their orders and your notes.")}
        actions={
          <button type="button" data-tour="cu-export" disabled={exporting} onClick={() => void exportCsv()} className={heroBtnGhost}>
            <Svg d={I_DOWNLOAD} className="h-4 w-4" />{exporting ? "…" : L("Exporter en CSV", "Export CSV")}
          </button>
        }
      />

      {selected && <Detail key={selected} ckey={selected} onClose={() => setParams({}, { replace: true })} />}

      {list.data && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
          <StatCard label={L("Clients", "Customers")} value={list.data.meta.total} icon={I_USERS} tone="info" />
          <StatCard label={L("Total dépensé", "Total spent")} value={formatPrice(pageSpent)} icon={I_COIN} tone="success" hint={L("sur cette page", "on this page")} />
          <StatCard label={L("Panier moyen", "Avg basket")} value={pageOrders > 0 ? formatPrice(Math.round(pageSpent / pageOrders)) : "—"} icon={I_BASKET} tone="warn" hint={L("sur cette page", "on this page")} />
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox tour="cu-search" value={input} onChange={setInput} placeholder={L("Nom, e-mail ou téléphone", "Name, email or phone")} />
        <Segmented
          value={sort} onChange={(v) => { setSort(v); setPage(1) }}
          items={[
            { id: "spent", label: L("Total dépensé", "Total spent") },
            { id: "orders", label: L("Commandes", "Orders") },
            { id: "recent", label: L("Récents", "Latest") },
            { id: "name", label: L("Nom A–Z", "Name A–Z") },
          ]}
        />
      </div>

      {list.isLoading && <LoadingState />}
      {list.error && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.data && rows.length === 0 && <EmptyState message={q ? L("Aucun client ne correspond.", "No matching customer.") : L("Aucun client pour le moment.", "No customers yet.")} />}

      {rows.length > 0 && (
        <>
          <ul data-tour="cu-list" className="grid gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => open(r)} className={`w-full rounded-card border border-line bg-surface p-3.5 text-left shadow-card transition active:scale-[0.99] ${r.orders_count === 0 ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={r.name ?? r.email ?? "?"} />
                    <div className="min-w-0 flex-1">
                      {name(r)}
                      <p className="truncate text-xs text-muted">{contact(r)}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-page p-2.5 text-center text-xs">
                    <div className="min-w-0"><dt className="text-muted">{L("Commandes", "Orders")}</dt><dd className="mt-0.5 font-bold">{r.orders_count}</dd></div>
                    <div className="min-w-0"><dt className="text-muted">{L("Dépensé", "Spent")}</dt><dd className="money mt-0.5 text-xs font-bold min-[400px]:text-sm">{formatPrice(r.spent)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted">{L("Dernière", "Latest")}</dt><dd className="mt-0.5 font-bold">{date(r.last_order_at)}</dd></div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>

          <div data-tour="cu-list" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{L("Client", "Customer")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{L("Commandes", "Orders")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{L("Total dépensé", "Total spent")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{L("Panier moyen", "Avg basket")}</th>
                  <th className="px-4 py-3 font-semibold">{L("Dernière commande", "Latest order")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key} tabIndex={0} onClick={() => open(r)} onKeyDown={(e) => { if (e.key === "Enter") open(r) }} className={`cursor-pointer transition hover:bg-primary/[0.04] ${r.orders_count === 0 ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name ?? r.email ?? "?"} size="sm" />
                        <div className="min-w-0">
                          {name(r)}
                          <p className="text-xs text-muted">{contact(r)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.orders_count}</td>
                    <td className="money whitespace-nowrap px-4 py-3 text-right font-bold">{formatPrice(r.spent)}</td>
                    <td className="money whitespace-nowrap px-4 py-3 text-right text-muted">{formatPrice(r.avg_basket)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-muted">{date(r.last_order_at)}</span>
                      {ago(r.last_order_at, fr) && <span className="ml-2 text-xs text-muted/70">{ago(r.last_order_at, fr)}</span>}
                    </td>
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





