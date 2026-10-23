import { useEffect, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import type { StockFilter, StockMeta, StockReason, StockRow, StockSort } from "../../api/admin"
import { formatPrice } from "../../lib/format"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import ProductImportPanel from "./ProductImportPanel"
import { Chip, Drawer, PageHeader, Pill, StatCard, Svg, Switch, Tabs, Thumb } from "../../components/admin/ui"
import { inputClass, labelClass } from "../../components/admin/adminStyles"

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

const I_BOX = "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"
const I_LAYERS = "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"
const I_COIN = "M12 21a9 9 0 100-18 9 9 0 000 18zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"
const I_ALERT = "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
const I_X = "M12 21a9 9 0 100-18 9 9 0 000 18zM15 9l-6 6M9 9l6 6"
const I_CLOCK = "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z"
const I_SEARCH = "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"

function errMsg(e: unknown): string {
  const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined
  return first ?? d?.message ?? "Une erreur est survenue."
}

function StockBar({ stock, threshold }: { stock: number; threshold: number }) {
  const cap = Math.max(threshold * 4, 1)
  const width = stock <= 0 ? 0 : Math.max(6, Math.min(100, Math.round((stock / cap) * 100)))
  const color = stock <= 0 ? "bg-danger" : stock <= threshold ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function Pager({ meta, onChange }: { meta: StockMeta; onChange: (p: number) => void }) {
  if (meta.last_page <= 1) return null
  return (
    <div className="mt-5 flex items-center justify-between gap-3 text-sm sm:justify-center">
      <Button variant="secondary" disabled={meta.current_page <= 1} onClick={() => onChange(meta.current_page - 1)}>Précédent</Button>
      <span className="whitespace-nowrap text-muted">{meta.current_page} / {meta.last_page}</span>
      <Button variant="secondary" disabled={meta.current_page >= meta.last_page} onClick={() => onChange(meta.current_page + 1)}>Suivant</Button>
    </div>
  )
}

const REASON_OPTS: { id: StockReason; label: string; hint: string }[] = [
  { id: "restock", label: "Réapprovisionnement", hint: "Ajoute des unités reçues" },
  { id: "damage", label: "Casse / perte", hint: "Retire des unités abîmées" },
  { id: "inventory", label: "Inventaire", hint: "Saisis le stock compté" },
  { id: "adjustment", label: "Correction", hint: "+ ou − (note requise)" },
]

function AdjustDrawer({ row, onClose, onDone }: { row: StockRow; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState<StockReason>("restock")
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const n = Number(qty)
  const valid = qty.trim() !== "" && Number.isInteger(n)
  const after = !valid ? null : reason === "restock" ? row.stock + n : reason === "damage" ? row.stock - n : reason === "inventory" ? n : row.stock + n
  const delta = after === null ? null : after - row.stock

  const save = useMutation({
    mutationFn: () => adminApi.adjustStock(row.slug, { reason, quantity: n, note: note.trim() || undefined }),
    onSuccess: async () => {
      await onDone()
      toast.success(`Stock de « ${row.name} » mis à jour.`)
      onClose()
    },
    onError: (e) => setError(errMsg(e)),
  })

  function submit(e?: FormEvent) {
    e?.preventDefault()
    setError("")
    if (!valid) return setError("Entre une quantité entière.")
    if ((reason === "restock" || reason === "damage") && n < 1) return setError("La quantité doit être au moins 1.")
    if (reason === "inventory" && n < 0) return setError("Le stock compté ne peut pas être négatif.")
    if (reason === "adjustment" && (n === 0 || !note.trim())) return setError("Une correction exige une quantité non nulle et une note.")
    if (after !== null && after < 0) return setError("Le stock ne peut pas passer sous 0.")
    save.mutate()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Ajuster le stock"
      subtitle={row.name}
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" form="adjust-form" loading={save.isPending} className="sm:min-w-[160px]">Enregistrer</Button>
          </div>
        </div>
      }
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <Thumb src={row.image_url} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.name}</p>
            <p className="text-sm text-muted">Stock actuel : <span className="font-bold text-ink">{row.stock}</span> · réservé : {row.reserved}</p>
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Motif</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {REASON_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={reason === o.id}
                onClick={() => setReason(o.id)}
                className={`rounded-lg border p-3 text-left transition ${reason === o.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-line bg-surface hover:border-primary/40"}`}
              >
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          {reason === "inventory" ? "Stock compté" : "Quantité"}
          <input type="number" step={1} inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        {(reason === "restock" || reason === "damage") && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {[1, 5, 10, 20, 50].map((q) => (
              <button key={q} type="button" onClick={() => setQty(String(q))} className="min-h-[36px] rounded-full border border-line bg-surface px-3 text-sm font-semibold text-muted hover:border-primary hover:text-primary">
                {reason === "restock" ? "+" : "−"}{q}
              </button>
            ))}
          </div>
        )}

        <label className={labelClass}>
          Note {reason === "adjustment" ? "(obligatoire)" : "(facultative)"}
          <input type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1`} />
        </label>

        {after !== null && delta !== null && (
          <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${after < 0 ? "border-danger/30 bg-danger/5" : "border-line bg-page"}`}>
            <span className="text-sm text-muted">Stock après</span>
            <span className="text-lg font-extrabold">
              {after}
              <span className={`ml-2 text-sm font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-danger" : "text-muted"}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </span>
          </div>
        )}
      </form>
    </Drawer>
  )
}

function QuickStock({ row, onDone, onError }: { row: StockRow; onDone: () => Promise<void>; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(row.stock))

  const save = useMutation({
    mutationFn: (n: number) => adminApi.adjustStock(row.slug, { reason: "inventory", quantity: n, note: "Edition rapide" }),
    onSuccess: async () => { await onDone(); setEditing(false) },
    onError: (e) => onError(errMsg(e)),
  })

  function commit() {
    const n = Number(val)
    if (val.trim() === "" || !Number.isInteger(n) || n < 0) return onError("Entre un stock entier (0 ou plus).")
    if (n === row.stock) return setEditing(false)
    save.mutate(n)
  }

  if (!editing) {
    return (
      <button type="button" title="Cliquer pour modifier le stock" onClick={() => { setVal(String(row.stock)); setEditing(true) }}
        className="min-h-[36px] min-w-[3rem] rounded-md border border-transparent px-2 py-1 text-base font-bold hover:border-line hover:bg-page">
        {row.stock}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <input type="number" min={0} step={1} inputMode="numeric" autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
        aria-label="Nouveau stock" className="min-h-[40px] w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <button type="button" disabled={save.isPending} onClick={commit}
        className="min-h-[40px] rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50">OK</button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Annuler"
        className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:text-ink">✕</button>
    </div>
  )
}

export default function AdminStockPage() {
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
  const [showImport, setShowImport] = useState(false)

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
      toast.success(r.is_published ? `« ${r.name} » est masqué du site.` : `« ${r.name} » est visible sur le site.`)
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
  const threshold = s?.low_stock_threshold ?? 5
  const rows = overview.data?.data ?? []
  const jRows = journal.data?.data ?? []
  const label = (r: string) => REASONS[r] ?? r
  const pickFilter = (f: StockFilter) => { setTab("inventory"); setFilter(filter === f ? "" : f); setPage(1) }
  const showHistory = (r: StockRow) => { setJProduct({ id: r.id, name: r.name }); setJPage(1); setTab("journal") }
  const productLink = (r: StockRow) => `/admin/boutique/produits?q=${encodeURIComponent(r.name)}`

  const filterLabels: Record<string, string> = {
    "": "Tous",
    low: `Stock bas${s ? ` (${s.low_count})` : ""}`,
    out: `Épuisés${s ? ` (${s.out_count})` : ""}`,
    reserved: "Avec réservations",
    unpublished: "Non publiés",
  }

  const statePill = (r: StockRow) =>
    r.status === "out" ? <Pill tone="danger" dot>Épuisé</Pill> : r.status === "low" ? <Pill tone="warn" dot>Stock bas</Pill> : <Pill tone="success" dot>En stock</Pill>

  const visibility = (r: StockRow) => (
    <label className="flex items-center gap-2">
      <Switch checked={r.is_published} disabled={togglePublish.isPending} onChange={() => togglePublish.mutate(r)} label={r.is_published ? "Masquer du site" : "Publier sur le site"} />
      <span className={`text-xs font-semibold ${!r.is_published ? "text-muted" : r.status === "out" ? "text-danger" : "text-emerald-700"}`}>
        {!r.is_published ? "Masqué" : r.status === "out" ? "Visible · épuisé" : "Visible"}
      </span>
    </label>
  )

  return (
    <div>
      <PageHeader
        title="Gestion du stock"
        subtitle="Suis les quantités, réapprovisionne et consulte l'historique des mouvements."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowImport((v) => !v)}>Importer (Excel / CSV)</Button>
            {tab === "inventory" && <Button variant="secondary" loading={exporting} onClick={() => void handleExport()}>Exporter en CSV</Button>}
          </>
        }
      />

      {notice && (
        <p role="status" className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{notice}</span>
          <button type="button" className="font-semibold" onClick={() => setNotice("")}>OK</button>
        </p>
      )}

      {s && (
        <>
          <div data-tour="sk-kpi" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Produits" value={s.products_total} icon={I_BOX} tone="info" active={filter === ""} onClick={() => pickFilter("")} />
            <StatCard label="Unités en stock" value={s.units} icon={I_LAYERS} tone="neutral" />
            <StatCard label="Valeur du stock" value={formatPrice(s.value)} icon={I_COIN} tone="success" />
            <StatCard label="Stock bas" hint={`seuil ${s.low_stock_threshold}`} value={s.low_count} icon={I_ALERT} tone="warn" active={filter === "low"} onClick={() => pickFilter("low")} />
            <StatCard label="Épuisés" value={s.out_count} icon={I_X} tone="danger" active={filter === "out"} onClick={() => pickFilter("out")} />
            <StatCard label="Réservées" hint="commandes en attente" value={s.reserved_units} icon={I_CLOCK} tone="info" active={filter === "reserved"} onClick={() => pickFilter("reserved")} />
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
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => pickFilter("out")}>Voir</button>
            </p>
          )}
        </>
      )}

      {showImport && <ProductImportPanel onDone={refreshAll} onClose={() => setShowImport(false)} />}

      <Tabs tour="sk-tabs" value={tab} onChange={setTab} items={[{ id: "inventory", label: "Inventaire" }, { id: "journal", label: "Journal des mouvements" }]} />

      {tab === "inventory" && (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"><Svg d={I_SEARCH} className="h-4 w-4" /></span>
              <input type="search" value={input} onChange={(e) => setInput(e.target.value)} data-tour="sk-search" placeholder="Rechercher un produit" className={`${inputClass} pl-9`} />
            </div>
            <select value={sort} onChange={(e) => { setSort(e.target.value as StockSort); setPage(1) }} aria-label="Trier" className={`${inputClass} sm:w-auto`}>
              <option value="stock_asc">Stock : du plus bas au plus haut</option>
              <option value="stock_desc">Stock : du plus haut au plus bas</option>
              <option value="name">Nom (A–Z)</option>
              <option value="recent">Plus récents</option>
            </select>
          </div>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" data-tour="sk-filters" aria-label="Filtres">
            {FILTERS.map((f) => (
              <Chip key={f || "all"} active={filter === f} onClick={() => { setFilter(f); setPage(1) }}>{filterLabels[f]}</Chip>
            ))}
          </div>

          {overview.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
          {overview.error && (
            <p role="alert" className="py-4 text-danger">{errMsg(overview.error)} <button type="button" className="font-semibold underline" onClick={() => void overview.refetch()}>Réessayer</button></p>
          )}
          {overview.data && rows.length === 0 && <p className="rounded-card border border-dashed border-line py-10 text-center text-muted">Aucun produit ne correspond.</p>}

          {rows.length > 0 && (
            <>
              {/* Mobile et tablette : cartes (1 colonne, puis 2 colonnes) */}
              <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
                {rows.map((r) => (
                  <li key={r.id} className="min-w-0 rounded-card border border-line bg-surface p-3.5 shadow-card">
                    <div className="flex items-start gap-3">
                      <Thumb src={r.image_url} className="h-14 w-14" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.name}</p>
                        <p className="text-xs text-muted">{formatPrice(r.price)}</p>
                        <div className="mt-1.5">{statePill(r)}</div>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-page p-2.5 text-center text-xs">
                      <div className="min-w-0">
                        <dt className="text-muted">Stock</dt>
                        <dd className="mt-0.5 flex justify-center"><QuickStock row={r} onDone={refreshAll} onError={setNotice} /></dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted">Réservé</dt>
                        <dd className="mt-2 text-base font-bold">{r.reserved}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted">Valeur</dt>
                        <dd className="money mt-2 text-xs font-bold min-[400px]:text-sm">{formatPrice(r.value)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      {visibility(r)}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setAdjusting(r)}>Ajuster</Button>
                        <Button size="sm" variant="secondary" onClick={() => showHistory(r)}>Historique</Button>
                        <Link to={productLink(r)} className="inline-flex min-h-[36px] items-center px-1 text-sm font-semibold text-primary hover:underline">Fiche</Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Grand écran : tableau */}
              <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card xl:block">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Produit</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-4 py-3 text-right font-semibold">Réservé</th>
                      <th className="px-4 py-3 text-right font-semibold">Valeur</th>
                      <th className="px-4 py-3 font-semibold">État</th>
                      <th className="px-4 py-3 font-semibold">Sur le site</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition hover:bg-page/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={r.image_url} className="h-11 w-11" />
                            <div className="min-w-0">
                              <p className="max-w-[24ch] truncate font-semibold">{r.name}</p>
                              <p className="text-xs text-muted">{formatPrice(r.price)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <QuickStock row={r} onDone={refreshAll} onError={setNotice} />
                          <div className="px-2"><StockBar stock={r.stock} threshold={threshold} /></div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted">{r.reserved}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatPrice(r.value)}</td>
                        <td className="px-4 py-3">{statePill(r)}</td>
                        <td className="px-4 py-3">{visibility(r)}</td>
                        <td className="px-4 py-3">
                          <div data-tour="sk-actions" className="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" onClick={() => setAdjusting(r)}>Ajuster</Button>
                            <Button size="sm" variant="secondary" onClick={() => showHistory(r)}>Historique</Button>
                            <Link to={productLink(r)} className="text-sm font-semibold text-primary hover:underline">Fiche</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {overview.data && <Pager meta={overview.data.meta} onChange={setPage} />}
        </>
      )}

      {tab === "journal" && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>Motif
              <select value={jReason} onChange={(e) => { setJReason(e.target.value); setJPage(1) }} className={`${inputClass} mt-1`}>
                <option value="">Tous les motifs</option>
                {Object.keys(REASONS).map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
            </label>
            <label className={labelClass}>Du
              <input type="date" value={jFrom} onChange={(e) => { setJFrom(e.target.value); setJPage(1) }} className={`${inputClass} mt-1`} />
            </label>
            <label className={labelClass}>Au
              <input type="date" value={jTo} onChange={(e) => { setJTo(e.target.value); setJPage(1) }} className={`${inputClass} mt-1`} />
            </label>
          </div>

          {jProduct && (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              Produit : <Pill tone="info">{jProduct.name}</Pill>
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setJProduct(null); setJPage(1) }}>Retirer le filtre</button>
            </p>
          )}

          {journal.isLoading && <p className="py-8 text-center text-muted">Chargement…</p>}
          {journal.error && <p role="alert" className="py-4 text-danger">{errMsg(journal.error)}</p>}
          {journal.data && jRows.length === 0 && <p className="rounded-card border border-dashed border-line py-10 text-center text-muted">Aucun mouvement pour le moment.</p>}

          {jRows.length > 0 && (
            <>
              <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
                {jRows.map((m) => (
                  <li key={m.id} className="rounded-card border border-line bg-surface p-3.5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{m.product?.name ?? "—"}</p>
                        <p className="text-xs text-muted">{label(m.reason)} · {new Date(m.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                      <span className={`text-lg font-extrabold ${m.quantity_change > 0 ? "text-emerald-700" : "text-danger"}`}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Stock après : <span className="font-semibold text-ink">{m.stock_after}</span>
                      {m.admin && ` · ${m.admin}`}
                      {m.note && ` · ${m.note}`}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card lg:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Produit</th>
                      <th className="px-4 py-3 font-semibold">Motif</th>
                      <th className="px-4 py-3 text-right font-semibold">Variation</th>
                      <th className="px-4 py-3 text-right font-semibold">Stock après</th>
                      <th className="px-4 py-3 font-semibold">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {jRows.map((m) => (
                      <tr key={m.id} className="hover:bg-page/60">
                        <td className="whitespace-nowrap px-4 py-3">{new Date(m.created_at).toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                        <td className="px-4 py-3">{label(m.reason)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${m.quantity_change > 0 ? "text-emerald-700" : "text-danger"}`}>
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
            </>
          )}
          {journal.data && <Pager meta={journal.data.meta} onChange={setJPage} />}
        </>
      )}

      {adjusting && <AdjustDrawer key={adjusting.id} row={adjusting} onClose={() => setAdjusting(null)} onDone={refreshAll} />}
    </div>
  )
}
