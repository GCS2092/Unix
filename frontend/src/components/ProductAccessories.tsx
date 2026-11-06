import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useCartStore } from "../stores/cartStore"
import { useDrawerStore } from "../stores/drawerStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { useFormatPrice } from "../hooks/useFormatPrice"
import Button from "./Button"
import type { Product, ProductAccessory } from "../types"

interface Props {
  device: Product
  quantity: number
  accessories: ProductAccessory[]
}

export default function AccessoriesSection({ device, quantity, accessories }: Props) {
  const { i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  const formatPrice = useFormatPrice()
  const add = useCartStore((s) => s.add)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<number[]>(() =>
    accessories.filter((a) => a.is_required && a.in_stock).map((a) => a.id),
  )

  const deviceAvailable = device.in_stock !== false
  const picked = accessories.filter((a) => selected.includes(a.id))
  const total = (deviceAvailable ? device.price * quantity : 0) + picked.reduce((n, a) => n + a.price, 0)
  const nothing = !deviceAvailable && picked.length === 0

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function addAll() {
    setBusy(true)
    try {
      if (deviceAvailable) await add("product", device.id, quantity)
      for (const a of picked) await add("product", a.id, 1)
      toast.success(en ? "Added to cart." : "Ajouté au panier.")
      useDrawerStore.getState().show()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-lg font-semibold">{en ? "Compatible accessories" : "Accessoires compatibles"}</h2>
      <p className="mt-1 text-sm text-muted">
        {en ? "All accessories are optional: tick what you need, then add everything in one click." : "Les accessoires sont facultatifs : cochez ce dont vous avez besoin, puis ajoutez le tout en un clic."}
      </p>
      <ul className="mt-4 divide-y divide-line">
        {accessories.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <input
              type="checkbox" className="h-5 w-5 flex-none accent-[var(--color-primary,#2563eb)]"
              checked={selected.includes(a.id)} disabled={!a.in_stock} onChange={() => toggle(a.id)}
              aria-label={a.name}
            />
            {a.image_url ? (
              <img src={a.image_url} alt="" loading="lazy" className="h-12 w-12 flex-none rounded-md border border-line object-cover" />
            ) : (
              <div className="h-12 w-12 flex-none rounded-md border border-line bg-page" />
            )}
            <div className="min-w-0 flex-1">
              <Link to={`/boutique/${a.slug}`} className="block truncate text-sm font-semibold hover:text-primary">{a.name}</Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                {a.is_required && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{en ? "Recommended" : "Recommandé"}</span>
                )}
                {!a.in_stock && <span className="text-muted">{en ? "Out of stock" : "Rupture de stock"}</span>}
              </div>
            </div>
            <p className="flex-none text-sm font-bold text-primary">{formatPrice(a.price)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {en ? "Total" : "Total"} : <span className="text-lg font-extrabold text-primary">{formatPrice(total)}</span>
        </p>
        <div className="min-w-0 max-w-xs flex-1">
          <Button full loading={busy} disabled={nothing} onClick={() => void addAll()}>
            {en ? "Add device + selection to cart" : "Ajouter l'appareil + la sélection"}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function CompatibleWith({ devices }: { devices: { id: number; name: string; slug: string }[] }) {
  const { i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-lg font-semibold">{en ? "Compatible with" : "Compatible avec"}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {devices.map((d) => (
          <li key={d.id}>
            <Link to={`/boutique/${d.slug}`} className="inline-flex min-h-[36px] items-center rounded-full border border-line bg-page px-3 text-sm font-semibold hover:border-primary hover:text-primary">
              {d.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}