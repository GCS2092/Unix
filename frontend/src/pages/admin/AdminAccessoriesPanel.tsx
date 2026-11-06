import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { accessoriesApi, type AccessoryRow } from "../../api/accessories"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { inputClass } from "../../components/admin/adminStyles"
import type { Product } from "../../types"

const miniBtn =
  "grid h-9 w-9 flex-none place-items-center rounded-md border border-line bg-surface text-sm transition hover:bg-black/5 active:scale-95 disabled:opacity-30"

export default function AdminAccessoriesPanel({ product }: { product: Product }) {
  const [rows, setRows] = useState<AccessoryRow[]>([])
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = useQuery({
    queryKey: ["admin-accessories", product.slug],
    queryFn: () => accessoriesApi.list(product.slug),
  })
  useEffect(() => {
    if (current.data) setRows(current.data)
  }, [current.data])

  const term = q.trim()
  const found = useQuery({
    queryKey: ["admin-accessories-search", term],
    queryFn: () => accessoriesApi.search(term),
    enabled: term.length >= 2,
    staleTime: 15_000,
  })
  const results = (found.data ?? []).filter((p) => p.id !== product.id && !rows.some((r) => r.id === p.id))

  function addRow(p: Product) {
    setRows((r) => [...r, {
      id: p.id, name: p.name, slug: p.slug, price: p.price, stock: p.stock ?? 0,
      kind: p.kind ?? "accessory", is_published: p.is_published ?? false, is_required: false,
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
  function setRequired(id: number, v: boolean) {
    setRows((x) => x.map((y) => (y.id === id ? { ...y, is_required: v } : y)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await accessoriesApi.save(product.slug, rows.map((r) => ({ id: r.id, is_required: r.is_required })))
      setRows(saved)
      toast.success("Accessoires enregistrés.")
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
          placeholder="Rechercher un accessoire à associer…" />
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
        <p className="text-sm text-muted">Aucun accessoire associé à ce produit.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted">{formatPrice(r.price)} · stock {r.stock}{!r.is_published ? " · non publié" : ""}</p>
              </div>
              <label className="flex flex-none items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" checked={r.is_required} onChange={(e) => setRequired(r.id, e.target.checked)}
                  className="h-4 w-4" />
                Obligatoire
              </label>
              <button type="button" className={miniBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
              <button type="button" className={miniBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
              <button type="button" className={miniBtn} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={saving || current.isLoading}
        className="min-h-[44px] rounded-lg bg-primary px-5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50">
        {saving ? "Enregistrement…" : "Enregistrer les accessoires"}
      </button>
    </div>
  )
}