import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import type { InvoiceRow, InvoiceStatus } from "../../api/admin"
import { saveBlob } from "../../lib/download"

const field =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

async function errText(e: unknown): Promise<string> {
  const d = (e as { response?: { data?: unknown } })?.response?.data
  if (d instanceof Blob) {
    try {
      const j = JSON.parse(await d.text()) as { message?: string }
      return j.message ?? "Une erreur est survenue."
    } catch {
      return "Une erreur est survenue."
    }
  }
  return (d as { message?: string } | undefined)?.message ?? "Une erreur est survenue."
}

function money(n: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${n} ${currency}`
  }
}

function Btn({ children, onClick, disabled, kind = "ghost" }: { children: ReactNode; onClick: () => void; disabled?: boolean; kind?: "primary" | "ghost" }) {
  const cls = kind === "primary" ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary"
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  )
}

function Kpi({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

export default function AdminInvoicesPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"

  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"" | InvoiceStatus>("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  // La selection est videe quand un filtre change (ajustement pendant le rendu)
  const filterKey = [q, status, from, to].join("|")
  const [selectedKey, setSelectedKey] = useState(filterKey)
  if (selectedKey !== filterKey) {
    setSelectedKey(filterKey)
    setSelected([])
  }

  const list = useQuery({
    queryKey: ["admin-invoices", page, q, status, from, to],
    queryFn: async () => (await adminApi.invoices(page, { q, status, from, to })).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const rows = list.data?.data ?? []
  const s = list.data?.summary
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const tooMany = s ? s.count > s.zip_limit : false

  function toggle(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }
  function togglePage() {
    setSelected((cur) => (allOnPage ? cur.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...cur, ...rows.map((r) => r.id)])]))
  }

  async function downloadOne(r: InvoiceRow) {
    setBusy(`pdf-${r.id}`)
    setError("")
    try {
      const res = await adminApi.invoicePdf(r.id)
      saveBlob(res.data, r.filename)
    } catch (e) {
      setError(await errText(e))
    } finally {
      setBusy(null)
    }
  }

  async function downloadZip(ids: number[]) {
    setBusy("zip")
    setError("")
    try {
      const res = await adminApi.invoicesZip({ ids, q, status, from, to })
      saveBlob(res.data, `factures-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch (e) {
      setError(await errText(e))
    } finally {
      setBusy(null)
    }
  }

  const hasFilter = Boolean(q || status || from || to)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Factures</h1>
        <div className="flex flex-wrap gap-2">
          <Btn disabled={selected.length === 0 || busy !== null} onClick={() => void downloadZip(selected)}>
            {busy === "zip" ? "Préparation…" : `Télécharger la sélection (${selected.length})`}
          </Btn>
          <Btn kind="primary" disabled={!s || s.count === 0 || tooMany || busy !== null} onClick={() => void downloadZip([])}>
            {busy === "zip" ? "Préparation…" : `Tout télécharger en ZIP${s ? ` (${s.count})` : ""}`}
          </Btn>
        </div>
      </div>

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Factures" value={s.count} />
          <Kpi label="Émises" value={s.issued_count} />
          <Kpi label="Annulées" value={s.cancelled_count} tone={s.cancelled_count > 0 ? "text-danger" : ""} />
          <Kpi label="Montant émis" value={money(s.issued_total, "XOF", locale)} />
        </div>
      )}

      {tooMany && s && (
        <p className="mb-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">
          {s.count} factures correspondent : le ZIP est limité à {s.zip_limit}. Réduis la période, ou coche des factures et utilise « Télécharger la sélection ».
        </p>
      )}
      {error && <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <label className="block text-sm font-medium sm:col-span-1">Recherche
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="N°, client, e-mail, commande" className={field} />
        </label>
        <label className="block text-sm font-medium">Statut
          <select value={status} onChange={(e) => { setStatus(e.target.value as "" | InvoiceStatus); setPage(1) }} className={field}>
            <option value="">Tous</option>
            <option value="issued">Émises</option>
            <option value="cancelled">Annulées</option>
          </select>
        </label>
        <label className="block text-sm font-medium">Du
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className={field} />
        </label>
        <label className="block text-sm font-medium">Au
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className={field} />
        </label>
      </div>
      {hasFilter && (
        <p className="mb-3 text-sm">
          <button type="button" className="font-semibold text-primary hover:underline"
            onClick={() => { setInput(""); setQ(""); setStatus(""); setFrom(""); setTo(""); setPage(1) }}>
            Réinitialiser les filtres
          </button>
        </p>
      )}

      {list.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
      {list.error && (
        <p role="alert" className="py-4 text-danger">
          Impossible de charger les factures.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void list.refetch()}>Réessayer</button>
        </p>
      )}
      {list.data && rows.length === 0 && <p className="py-8 text-center text-muted">Aucune facture ne correspond.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="h-4 w-4" checked={allOnPage} onChange={togglePage} aria-label="Tout sélectionner sur cette page" />
                </th>
                <th className="px-4 py-3 font-medium">Numéro</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <input type="checkbox" className="h-4 w-4" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Sélectionner ${r.number}`} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">{r.number}</td>
                  <td className="whitespace-nowrap px-4 py-3">{r.issued_at ? new Date(r.issued_at).toLocaleDateString(locale) : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.customer_name ?? "—"}</p>
                    <p className="text-xs text-muted">{r.customer_email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/boutique/commandes?q=${r.order_id}`} className="font-semibold text-primary hover:underline">#{r.order_id}</Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{money(r.total, r.currency, locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "cancelled" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                      {r.status === "cancelled" ? "Annulée" : "Émise"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Btn disabled={busy !== null} onClick={() => void downloadOne(r)}>{busy === `pdf-${r.id}` ? "…" : "PDF"}</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.data && list.data.meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Btn disabled={list.data.meta.current_page <= 1} onClick={() => setPage(list.data.meta.current_page - 1)}>Précédent</Btn>
          <span className="text-muted">Page {list.data.meta.current_page} / {list.data.meta.last_page}</span>
          <Btn disabled={list.data.meta.current_page >= list.data.meta.last_page} onClick={() => setPage(list.data.meta.current_page + 1)}>Suivant</Btn>
        </div>
      )}
    </div>
  )
}