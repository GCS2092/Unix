import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import type { StockFilter, StockMeta, StockReason, StockRow, StockSort } from "../../api/admin"

const REASONS: Record<string, string> = {
  reserve: "Réservation (commande)",
  release: "Libération (paiement échoué)",
  cancel: "Annulation de commande",
  expire: "Réservation expirée",
  restock: "Réapprovisionnement",
  damage: "Casse / perte",
  inventory: "Inventaire",
  adjustment: "Correction manuelle",
  initial: "Stock initial",
}

const FILTERS: StockFilter[] = ["", "low", "out", "reserved", "unpublished"]

const field =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function errMsg(e: unknown): string {
  const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  return first ?? d?.message ?? "Une erreur est survenue."
}

function money(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n)
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink"}`}>
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

function Pager({ meta, onChange }: { meta: StockMeta; onChange: (p: number) => void }) {
  if (meta.last_page <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <Btn disabled={meta.current_page <= 1} onClick={() => onChange(meta.current_page - 1)}>Précédent</Btn>
      <span className="text-muted">Page {meta.current_page} / {meta.last_page}</span>
      <Btn disabled={meta.current_page >= meta.last_page} onClick={() => onChange(meta.current_page + 1)}>Suivant</Btn>
    </div>
  )
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{children}</span>
}

function AdjustPanel({ row, onClose, onDone }: { row: StockRow; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState<StockReason>("restock")
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const n = Number(qty)
  const valid = qty.trim() !== "" && Number.isInteger(n)
  const after = !valid ? null : reason === "restock" ? row.stock + n : reason === "damage" ? row.stock - n : reason === "inventory" ? n : row.stock + n

  const save = useMutation({
    mutationFn: () => adminApi.adjustStock(row.slug, { reason, quantity: n, note: note.trim() || undefined }),
    onSuccess: async () => { await onDone(); onClose() },
    onError: (e) => setError(errMsg(e)),
  })

  function submit() {
    setError("")
    if (!valid) return setError("Entre une quantité entière.")
    if ((reason === "restock" || reason === "damage") && n < 1) return setError("La quantité doit être au moins 1.")
    if (reason === "inventory" && n < 0) return setError("Le stock compté ne peut pas être négatif.")
    if (reason === "adjustment" && (n === 0 || !note.trim())) return setError("Une correction exige une quantité non nulle et une note.")
    if (after !== null && after < 0) return setError("Le stock ne peut pas passer sous 0.")
    save.mutate()
  }

  return (
    <div className="mb-4 rounded-card border border-primary/40 bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Ajuster le stock : {row.name} <span className="font-normal text-muted">(actuel : {row.stock})</span></h2>
        <Btn onClick={onClose}>Fermer</Btn>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">Motif
          <select value={reason} onChange={(e) => setReason(e.target.value as StockReason)} className={field}>
            <option value="restock">Réapprovisionnement (ajoute)</option>
            <option value="damage">Casse / perte (retire)</option>
            <option value="inventory">Inventaire (stock compté)</option>
            <option value="adjustment">Correction (+ ou −)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">Quantité
          <input type="number" step={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">Note {reason === "adjustment" ? "(obligatoire)" : "(facultative)"}
          <input type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
      </div>
      {after !== null && <p className="mt-2 text-sm text-muted">Stock après : <span className="font-semibold text-ink">{after}</span></p>}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-3"><Btn kind="primary" disabled={save.isPending} onClick={submit}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Btn></div>
    </div>
  )
}

export default function AdminStockPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const urlFilter = params.get("filter") ?? ""
  const urlQ = params.get("q") ?? ""

  const [tab, setTab] = useState<"inventory" | "journal">("inventory")
  const [input, setInput] = useState(urlQ)
  const [q, setQ] = useState(urlQ.trim())
  const [filter, setFilter] = useState<StockFilter>((FILTERS as string[]).includes(urlFilter) ? (urlFilter as StockFilter) : "")
  const [sort, setSort] = useState<StockSort>("stock_asc")
  const [page, setPage] = useState(1)
  const [adjusting, setAdjusting] = useState<StockRow | null>(null)
  const [notice, setNotice] = useState("")
  const [exporting, setExporting] = useState(false)

  const [jReason, setJReason] = useState("")
  const [jFrom, setJFrom] = useState("")
  const [jTo, setJTo] = useState("")
  const [jProduct, setJProduct] = useState<{ id: number; name: string } | null>(null)
  const [jPage, setJPage] = useState(1)

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  // Garde la page synchronisée avec l'URL (?q= et ?filter=), même si elle est déjà ouverte
  const urlKey = JSON.stringify([urlQ, urlFilter])
  const [seenUrl, setSeenUrl] = useState<string | null>(null)
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey)
    setInput(urlQ)
    setQ(urlQ.trim())
    setFilter((FILTERS as string[]).includes(urlFilter) ? (urlFilter as StockFilter) : "")
    setPage(1)
  }

  const overview = useQuery({
    queryKey: ["admin-stock", page, q, filter, sort],
    queryFn: async () => (await adminApi.stockOverview(page, { q, filter, sort })).data,
    staleTime: 0,
  })

  const journal = useQuery({
    queryKey: ["admin-stock-journal", jPage, jReason, jFrom, jTo, jProduct?.id ?? 0],
    queryFn: async () => (await adminApi.stockJournal(jPage, { reason: jReason, from: jFrom, to: jTo, product_id: jProduct?.id })).data,
    enabled: tab === "journal",
    staleTime: 0,
  })

  async function refreshAll() {
    await Promise.all(
      ["admin-stock", "admin-stock-journal", "admin-products", "products", "admin-dashboard"].map((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      ),
    )
  }

  const togglePublish = useMutation({
    mutationFn: (r: StockRow) => adminApi.updateProduct(r.slug, { is_published: !r.is_published }),
    onSuccess: async (_res, r) => {
      setNotice(r.is_published ? `« ${r.name} » est masqué du site.` : `« ${r.name} » est visible sur le site.`)
      await refreshAll()
    },
    onError: (e) => setNotice(errMsg(e)),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminApi.exportStock({ q, filter, sort })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setNotice(errMsg(e))
    } finally {
      setExporting(false)
    }
  }

  const s = overview.data?.summary
  const rows = overview.data?.data ?? []
  const jRows = journal.data?.data ?? []
  const label = (r: string) => REASONS[r] ?? r

  const filterLabels: Record<string, string> = {
    "": "Tous",
    low: `Stock bas${s ? ` (${s.low_count})` : ""}`,
    out: `Épuisés${s ? ` (${s.out_count})` : ""}`,
    reserved: "Avec réservations",
    unpublished: "Non publiés",
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Gestion du stock</h1>
        {tab === "inventory" && <Btn disabled={exporting} onClick={() => void handleExport()}>{exporting ? "Export…" : "Exporter en CSV"}</Btn>}
      </div>

      {notice && (
        <p role="status" className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <span>{notice}</span>
          <button type="button" className="font-semibold text-primary" onClick={() => setNotice("")}>OK</button>
        </p>
      )}

      {s && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Produits" value={s.products_total} />
            <Kpi label="Unités en stock" value={s.units} />
            <Kpi label="Valeur du stock" value={money(s.value, locale)} />
            <Kpi label={`Stock bas (seuil ${s.low_stock_threshold})`} value={s.low_count} tone={s.low_count > 0 ? "text-accent" : ""} />
            <Kpi label="Épuisés" value={s.out_count} tone={s.out_count > 0 ? "text-danger" : ""} />
            <Kpi label="Unités réservées" value={s.reserved_units} />
          </div>
          {s.conflicts > 0 && (
            <p role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm">
              <span className="font-medium text-danger">{s.conflicts} commande(s) payée(s) sans stock disponible.</span>
              <Link to="/admin/boutique/commandes?quick=stock_conflict" className="font-semibold text-primary hover:underline">Traiter les conflits</Link>
            </p>
          )}
          {s.published_out > 0 && (
            <p className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <span>{s.published_out} produit(s) publié(s) sont épuisés : le site affiche « Épuisé » et bloque l'ajout au panier.</span>
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setTab("inventory"); setFilter("out"); setPage(1) }}>Voir</button>
            </p>
          )}
        </>
      )}

      <div className="mb-4 flex gap-2" role="tablist">
        <Chip active={tab === "inventory"} onClick={() => setTab("inventory")}>Inventaire</Chip>
        <Chip active={tab === "journal"} onClick={() => setTab("journal")}>Journal des mouvements</Chip>
      </div>

      {tab === "inventory" && (
        <>
          {adjusting && <AdjustPanel key={adjusting.id} row={adjusting} onClose={() => setAdjusting(null)} onDone={refreshAll} />}

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Rechercher un produit"
              className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:max-w-sm" />
            <select value={sort} onChange={(e) => { setSort(e.target.value as StockSort); setPage(1) }} aria-label="Trier"
              className="min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2">
              <option value="stock_asc">Stock : du plus bas au plus haut</option>
              <option value="stock_desc">Stock : du plus haut au plus bas</option>
              <option value="name">Nom (A–Z)</option>
              <option value="recent">Plus récents</option>
            </select>
          </div>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtres">
            {FILTERS.map((f) => (
              <Chip key={f || "all"} active={filter === f} onClick={() => { setFilter(f); setPage(1) }}>{filterLabels[f]}</Chip>
            ))}
          </div>

          {overview.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
          {overview.error && (
            <p role="alert" className="py-4 text-danger">{errMsg(overview.error)} <button type="button" className="font-semibold underline" onClick={() => void overview.refetch()}>Réessayer</button></p>
          )}
          {overview.data && rows.length === 0 && <p className="py-8 text-center text-muted">Aucun produit ne correspond.</p>}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line bg-page text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Réservé</th>
                    <th className="px-4 py-3 text-right font-medium">Valeur</th>
                    <th className="px-4 py-3 font-medium">État</th>
                    <th className="px-4 py-3 font-medium">Sur le site</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.image_url
                            ? <img src={r.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
                            : <div className="h-10 w-10 shrink-0 rounded-md border border-line bg-page" />}
                          <div className="min-w-0">
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted">{money(r.price, locale)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{r.stock}</td>
                      <td className="px-4 py-3 text-right text-muted">{r.reserved}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{money(r.value, locale)}</td>
                      <td className="px-4 py-3">
                        <Pill tone={r.status === "out" ? "bg-danger/10 text-danger" : r.status === "low" ? "bg-accent/15 text-accent" : "bg-success/10 text-success"}>
                          {r.status === "out" ? "Épuisé" : r.status === "low" ? "Stock bas" : "En stock"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={!r.is_published ? "bg-page text-muted" : r.status === "out" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}>
                          {!r.is_published ? "Masqué" : r.status === "out" ? "Visible · Épuisé" : "Visible"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Btn kind="primary" onClick={() => { setAdjusting(r); window.scrollTo({ top: 0, behavior: "smooth" }) }}>Ajuster</Btn>
                          <Btn onClick={() => { setJProduct({ id: r.id, name: r.name }); setJPage(1); setTab("journal") }}>Historique</Btn>
                          <Btn disabled={togglePublish.isPending} onClick={() => togglePublish.mutate(r)}>{r.is_published ? "Masquer" : "Publier"}</Btn>
                          <Link to="/admin/boutique/produits" className="text-sm font-semibold text-primary hover:underline">Fiche</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {overview.data && <Pager meta={overview.data.meta} onChange={setPage} />}
        </>
      )}

      {tab === "journal" && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium">Motif
              <select value={jReason} onChange={(e) => { setJReason(e.target.value); setJPage(1) }} className={field}>
                <option value="">Tous les motifs</option>
                {Object.keys(REASONS).map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Du
              <input type="date" value={jFrom} onChange={(e) => { setJFrom(e.target.value); setJPage(1) }} className={field} />
            </label>
            <label className="block text-sm font-medium">Au
              <input type="date" value={jTo} onChange={(e) => { setJTo(e.target.value); setJPage(1) }} className={field} />
            </label>
          </div>

          {jProduct && (
            <p className="mb-3 text-sm">
              Produit : <span className="font-semibold">{jProduct.name}</span>{" "}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setJProduct(null); setJPage(1) }}>Retirer le filtre</button>
            </p>
          )}

          {journal.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
          {journal.error && <p role="alert" className="py-4 text-danger">{errMsg(journal.error)}</p>}
          {journal.data && jRows.length === 0 && <p className="py-8 text-center text-muted">Aucun mouvement pour le moment.</p>}

          {jRows.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-line bg-page text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Motif</th>
                    <th className="px-4 py-3 text-right font-medium">Variation</th>
                    <th className="px-4 py-3 text-right font-medium">Stock après</th>
                    <th className="px-4 py-3 font-medium">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {jRows.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(m.created_at).toLocaleString(locale)}</td>
                      <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                      <td className="px-4 py-3">{label(m.reason)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.quantity_change > 0 ? "text-success" : "text-danger"}`}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </td>
                      <td className="px-4 py-3 text-right">{m.stock_after}</td>
                      <td className="px-4 py-3 text-muted">
                        {m.admin && <span>{m.admin} </span>}
                        {m.order_id && <Link to={`/admin/boutique/commandes?q=${m.order_id}`} className="font-semibold text-primary hover:underline">#{m.order_id} </Link>}
                        {m.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {journal.data && <Pager meta={journal.data.meta} onChange={setJPage} />}
        </>
      )}
    </div>
  )
}