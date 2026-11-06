import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { bundlesApi, type BundleRow } from "../../api/bundles"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { inputClass } from "../../components/admin/adminStyles"
import type { Product } from "../../types"

const miniBtn =
  "grid h-9 w-9 flex-none place-items-center rounded-md border border-line bg-surface text-sm transition hover:bg-black/5 active:scale-95 disabled:opacity-30"

export default function AdminBundlePanel({ product }: { product: Product }) {
  const [rows, setRows] = useState<BundleRow[]>([])
  const [packStock, setPackStock] = useState<number | null>(null)
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = useQuery({
    queryKey: ["admin-bundle", product.slug],
    queryFn: () => bundlesApi.list(product.slug),
  })
  useEffect(() => {
    if (current.data) { setRows(current.data.components); setPackStock(current.data.pack_stock) }
  }, [current.data])

  const term = q.trim()
  const found = useQuery({
    queryKey: ["admin-bundle-search", term],
    queryFn: () => bundlesApi.search(term),
    enabled: term.length >= 2,
    staleTime: 15_000,
  })
  const results = (found.data ?? []).filter((p) => p.id !== product.id && p.kind !== "bundle" && !rows.some((r) => r.id === p.id))

  function addRow(p: Product) {
    setRows((r) => [...r, {
      id: p.id, name: p.name, slug: p.slug, price: p.price, stock: p.stock ?? 0,
      kind: p.kind ?? "device", is_published: p.is_published ?? false, quantity: 1,
    }])
    setQ("")
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }
  function setQty(id: number, v: string) {
    const n = Math.max(1, Math.min(999, Math.floor(Number(v) || 1)))
    setRows((x) => x.map((y) => (y.id === id ? { ...y, quantity: n } : y)))
  }

  const value = rows.reduce((n, r) => n + r.price * r.quantity, 0)
  const bundleSaving = value - product.price
  const estimate = rows.length === 0 ? 0 : Math.min(...rows.map((r) => Math.floor(Math.max(0, r.stock) / r.quantity)))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await bundlesApi.save(product.slug, rows.map((r) => ({ id: r.id, quantity: r.quantity })))
      setRows(saved.components)
      setPackStock(saved.pack_stock)
      toast.success("Composition du pack enregistrée.")
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
          placeholder="Rechercher un produit à ajouter au pack…" />
        {term.length >= 2 && (
          <ul className="mt-2 max-h-56 divide-y divide-line overflow-auto rounded-lg border border-line bg-surface">
            {found.isLoading && <li className="p-3 text-sm text-muted">Recherche…</li>}
            {!found.isLoading && results.length === 0 && <li className="p-3 text-sm text-muted">Aucun résultat.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addRow(p)} className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-black/5">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="flex-none text-muted">{formatPrice(p.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {current.isLoading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Pack vide : tant qu'il n'a pas de composants, il apparaît en rupture de stock.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted">{formatPrice(r.price)} · stock {r.stock}{!r.is_published ? " · non publié" : ""}</p>
              </div>
              <label className="flex flex-none items-center gap-1.5 text-xs font-semibold">
                Qté
                <input type="number" min={1} max={999} value={r.quantity} onChange={(e) => setQty(r.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
                  className="h-9 w-16 rounded-md border border-line bg-surface px-2 text-sm" />
              </label>
              <button type="button" className={miniBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
              <button type="button" className={miniBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
              <button type="button" className={miniBtn} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <dl className="grid gap-2 rounded-xl bg-primary/5 p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted">Valeur des composants</dt><dd className="font-semibold">{formatPrice(value)}</dd></div>
          <div><dt className="text-xs text-muted">Prix du pack (étape Prix)</dt><dd className="font-semibold">{formatPrice(product.price)}{bundleSaving < 0 ? " · supérieur à la valeur" : bundleSaving > 0 ? ` · remise ${formatPrice(bundleSaving)}` : ""}</dd></div>
          <div><dt className="text-xs text-muted">Packs vendables</dt><dd className="font-semibold">{packStock ?? estimate}</dd></div>
        </dl>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={saving || current.isLoading}
        className="min-h-[44px] rounded-lg bg-primary px-5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50">
        {saving ? "Enregistrement…" : "Enregistrer la composition"}
      </button>
    </div>
  )
}
