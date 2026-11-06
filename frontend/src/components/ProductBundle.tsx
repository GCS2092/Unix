import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Product } from "../types"

export default function BundleContents({ bundle }: { bundle: Product }) {
  const { i18n } = useTranslation()
  const en = i18n.language.startsWith("en")
  const formatPrice = useFormatPrice()
  const items = bundle.components ?? []
  const value = bundle.components_value ?? 0
  const saving = value - bundle.price

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-lg font-semibold">{en ? "What's in this pack" : "Ce pack contient"}</h2>
      <ul className="mt-4 divide-y divide-line">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            {c.image_url ? (
              <img src={c.image_url} alt="" loading="lazy" className="h-12 w-12 flex-none rounded-md border border-line object-cover" />
            ) : (
              <div className="h-12 w-12 flex-none rounded-md border border-line bg-page" />
            )}
            <div className="min-w-0 flex-1">
              <Link to={`/boutique/${c.slug}`} className="block truncate text-sm font-semibold hover:text-primary">{c.name}</Link>
              {!c.in_stock && <span className="text-xs text-muted">{en ? "Out of stock" : "Rupture de stock"}</span>}
            </div>
            <p className="flex-none text-sm font-bold">× {c.quantity}</p>
          </li>
        ))}
      </ul>
      {saving > 0 && (
        <p className="mt-4 rounded-lg bg-primary/5 px-3 py-2 text-sm">
          {en ? "Separate value" : "Valeur à l'unité"} : <span className="line-through">{formatPrice(value)}</span>{" "}
          — <span className="font-bold text-primary">{en ? "you save" : "vous économisez"} {formatPrice(saving)}</span>
        </p>
      )}
    </section>
  )
}