import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [allKinds, setAllKinds] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const current = useQuery({
    queryKey: ["admin-accessories", product.slug],
    queryFn: () => accessoriesApi.list(product.slug),
  })
  useEffect(() => {
    if (current.data) setRows(current.data)
  }, [current.data])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const term = q.trim()
  const found = useQuery({
    queryKey: ["admin-accessories-search", term],
    queryFn: () => accessoriesApi.search(term),
    enabled: open,
    staleTime: 15_000,
  })
  const options = (found.data ?? []).filter(
    (p) => p.id !== product.id && p.kind !== "bundle" && (allKinds || p.kind === "accessory"),
  )

  const isChecked = (id: number) => rows.some((r) => r.id === id)

  async function commit(next: AccessoryRow[]) {
    const before = rows
    setRows(next)
    setSaving(true)
    setError(null)
    try {
      const saved = await accessoriesApi.save(product.slug, next.map((r) => ({ id: r.id, is_required: r.is_required })))
      setRows(saved)
      queryClient.setQueryData(["admin-accessories", product.slug], saved)
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      await queryClient.invalidateQueries({ queryKey: ["catalog"] })
      toast.success("Accessoires enregistrés.")
    } catch (e) {
      setRows(before)
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function toggle(p: Product) {
    void commit(
      rows.some((r) => r.id === p.id)
        ? rows.filter((r) => r.id !== p.id)
        : [...rows, {
            id: p.id, name: p.name, slug: p.slug, price: p.price, stock: p.stock ?? 0,
            kind: p.kind ?? "accessory", is_published: p.is_published ?? false, is_required: false,
          }],
    )
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    void commit(next)
  }
  function setRequired(id: number, v: boolean) {
    void commit(rows.map((y) => (y.id === id ? { ...y, is_required: v } : y)))
  }
  function save() { return commit(rows) }
  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`${inputClass} flex w-full items-center justify-between gap-3 text-left`}
        >
          <span className={rows.length ? "font-semibold" : "text-muted"}>
            {rows.length === 0
              ? "Choisir les accessoires compatibles…"
              : `${rows.length} accessoire${rows.length > 1 ? "s" : ""} sélectionné${rows.length > 1 ? "s" : ""}`}
          </span>
          <span aria-hidden className={`text-muted transition ${open ? "rotate-180" : ""}`}>▾</span>
        </button>

        {open && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
            <div className="space-y-2 border-b border-line p-2">
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
                placeholder="Filtrer par nom…"
                autoFocus
              />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" className="h-4 w-4" checked={allKinds} onChange={(e) => setAllKinds(e.target.checked)} />
                Afficher aussi les appareils (pas seulement les accessoires)
              </label>
            </div>
            <ul className="max-h-64 divide-y divide-line overflow-auto">
              {found.isLoading && <li className="p-3 text-sm text-muted">Chargement…</li>}
              {!found.isLoading && options.length === 0 && (
                <li className="p-3 text-sm text-muted">Aucun accessoire trouvé. Crée-le d'abord comme produit de type « accessoire ».</li>
              )}
              {options.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-black/5">
                    <input type="checkbox" className="h-4 w-4 flex-none" checked={isChecked(p.id)} disabled={saving} onChange={() => toggle(p)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="flex-none text-xs text-muted">{formatPrice(p.price)} · stock {p.stock ?? 0}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line p-2">
              <span className="text-xs text-muted">{rows.length} sélectionné{rows.length > 1 ? "s" : ""}</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary hover:bg-black/5">
                Terminé
              </button>
            </div>
          </div>
        )}
      </div>

      {current.isLoading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun accessoire associé à ce produit.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted">{formatPrice(r.price)} · stock {r.stock}{!r.is_published ? " · non publié" : ""}</p>
              </div>
              <label className="flex flex-none items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" className="h-4 w-4" checked={r.is_required} onChange={(e) => setRequired(r.id, e.target.checked)} />
                Indispensable
              </label>
              <button type="button" className={miniBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
              <button type="button" className={miniBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
              <button type="button" className={miniBtn} disabled={saving} onClick={() => void commit(rows.filter((y) => y.id !== r.id))} aria-label="Retirer">✕</button>
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