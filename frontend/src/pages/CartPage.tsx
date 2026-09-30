import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { getErrorMessage } from "../lib/errors"
import { EmptyState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import { buttonClass } from "../components/Button"
import ProductImage from "../components/ProductImage"
import type { CartItemType } from "../types"

const qtyBtn =
  "flex h-10 w-10 items-center justify-center text-ink transition hover:bg-page active:bg-line/60 disabled:cursor-default disabled:text-muted/50 disabled:hover:bg-transparent"

interface Removed {
  type: CartItemType
  id: number
  quantity: number
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const TRASH = "M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3"
const MINUS = "M5 12h14"
const PLUS = "M12 5v14M5 12h14"

export default function CartPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const loaded = useCartStore((s) => s.loaded)
  const cart = useCartStore((s) => s.cart)
  const add = useCartStore((s) => s.add)
  const update = useCartStore((s) => s.update)
  const remove = useCartStore((s) => s.remove)
  const [undo, setUndo] = useState<Removed | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function run(action: () => Promise<void>) {
    try {
      await action()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function removeItem(type: CartItemType, id: number, quantity: number) {
    try {
      await remove(type, id)
      setUndo({ type, id, quantity })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setUndo(null), 5000)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function restore() {
    if (!undo) return
    const back = undo
    setUndo(null)
    if (timer.current) clearTimeout(timer.current)
    await run(() => add(back.type, back.id, back.quantity))
  }

  async function clearAll() {
    if (!window.confirm(t("cart.clear_confirm", { defaultValue: "Vider tout le panier ?" }))) return
    setUndo(null)
    await run(async () => {
      for (const item of [...cart.items]) await remove(item.type, item.id)
    })
  }

  const undoBar = undo && (
    <div role="status" className="mb-4 flex items-center justify-between rounded-lg bg-ink px-4 py-2.5 text-sm text-white">
      <span>{t("cart.removed")}</span>
      <button type="button" onClick={() => void restore()} className="font-semibold text-primary-light hover:underline">
        {t("cart.undo", { defaultValue: "Annuler" })}
      </button>
    </div>
  )

  if (!loaded) return <ListSkeleton />

  if (cart.items.length === 0) {
    return (
      <div className="py-8 text-center">
        {undoBar}
        <EmptyState message={t("cart.empty")} />
        <Link to="/boutique" className={buttonClass({ size: "lg" })}>{t("cart.go_shop")}</Link>
      </div>
    )
  }

  const count = cart.items.reduce((n, i) => n + i.quantity, 0)

  const summary = (
    <>
      <div className="flex justify-between text-sm text-muted">
        <span>{t("cart.subtotal", { defaultValue: "Sous-total" })}</span>
        <span>{formatPrice(cart.total)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4 text-sm text-muted">
        <span>{t("cart.delivery", { defaultValue: "Livraison" })}</span>
        <span className="text-right">{t("cart.delivery_next", { defaultValue: "Calculée à l'étape suivante" })}</span>
      </div>
      <p className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
        <span>{t("cart.total")}</span>
        <span className="text-primary">{formatPrice(cart.total)}</span>
      </p>
    </>
  )

  return (
    <div className="pb-28 lg:pb-0">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t("cart.title")} <span className="text-lg font-normal text-muted">({count})</span>
        </h1>
        <button type="button" onClick={() => void clearAll()} className="text-sm text-muted underline hover:text-danger">
          {t("cart.clear", { defaultValue: "Vider le panier" })}
        </button>
      </div>
      {undoBar}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {cart.items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex gap-3 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line">
                  <ProductImage src={item.image_url} alt={item.title} compact />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    {item.type === "product" ? (
                      <Link to={`/boutique/${item.slug}`} className="line-clamp-2 font-semibold hover:text-primary">{item.title}</Link>
                    ) : (
                      <p className="line-clamp-2 font-semibold">{item.title}</p>
                    )}
                    <button
                      type="button"
                      aria-label={t("cart.remove")}
                      onClick={() => void removeItem(item.type, item.id, item.quantity)}
                      className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger active:scale-95"
                    >
                      <Icon d={TRASH} />
                    </button>
                  </div>
                  <p className="text-sm text-muted">{formatPrice(item.unit_price)}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center overflow-hidden rounded-lg border border-line bg-surface" role="group" aria-label={t("ux.quantity")}>
                      <button
                        type="button"
                        aria-label={t("cart.decrease")}
                        disabled={item.quantity <= 1}
                        onClick={() => void run(() => update(item.type, item.id, item.quantity - 1))}
                        className={qtyBtn}
                      >
                        <Icon d={MINUS} />
                      </button>
                      <span className="w-8 text-center font-medium" aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={t("cart.increase")}
                        onClick={() => void run(() => update(item.type, item.id, item.quantity + 1))}
                        className={qtyBtn}
                      >
                        <Icon d={PLUS} />
                      </button>
                    </div>
                    <p className="font-bold text-primary">{formatPrice(item.line_total)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <section className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card lg:hidden">{summary}</section>
        </div>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          <h2 className="mb-3 font-semibold">{t("cart.summary")}</h2>
          {summary}
          <Link to="/commande" className={buttonClass({ full: true, size: "lg", className: "mt-4" })}>
            {t("cart.checkout")}
          </Link>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="text-xs text-muted">{t("cart.total")}</p>
            <p className="text-xl font-extrabold text-primary">{formatPrice(cart.total)}</p>
          </div>
          <Link to="/commande" className={buttonClass({ full: true, size: "lg", className: "flex-1" })}>
            {t("cart.order")}
          </Link>
        </div>
      </div>
    </div>
  )
}