import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAutoAnimate } from "@formkit/auto-animate/react"
import { Minus, Plus, Trash2, Truck } from "lucide-react"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { shippingApi } from "../api/shipping"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { getErrorMessage } from "../lib/errors"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import { buttonClass } from "../components/buttonStyles"
import ProductImage from "../components/ProductImage"
import Suggestions from "../components/Suggestions"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"
import { openWaDesk } from "../lib/waDesk"
import type { CartItemType } from "../types"

const qtyBtn =
  "flex h-10 w-10 items-center justify-center text-ink transition hover:bg-page active:bg-line/60 disabled:cursor-not-allowed disabled:text-muted/50 disabled:hover:bg-transparent"

interface Removed {
  type: CartItemType
  id: number
  quantity: number
}

export default function CartPage() {
  const { t, i18n } = useTranslation()
  const formatPrice = useFormatPrice()
  const loaded = useCartStore((s) => s.loaded)
  const cartError = useCartStore((s) => s.error)
  const fetchCart = useCartStore((s) => s.fetch)
  const cart = useCartStore((s) => s.cart)
  const add = useCartStore((s) => s.add)
  const update = useCartStore((s) => s.update)
  const remove = useCartStore((s) => s.remove)
  const [undo, setUndo] = useState<Removed | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [listRef] = useAutoAnimate<HTMLUListElement>()
  const ship = useQuery({
    queryKey: ["shipping"],
    queryFn: async () => (await shippingApi.get()).data.data,
    staleTime: 60_000,
  })

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
    <div role="status" className="animate-fade-up mb-4 flex items-center justify-between rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-card">
      <span>{t("cart.removed")}</span>
      <button type="button" onClick={() => void restore()} className="font-semibold text-primary-light hover:underline">
        {t("cart.undo", { defaultValue: "Annuler" })}
      </button>
    </div>
  )

  if (!loaded) return <ListSkeleton />

  if (cartError && cart.items.length === 0) {
    return <ErrorState error={cartError} onRetry={() => void fetchCart().catch(() => undefined)} />
  }

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
  const fr = i18n.language.startsWith("fr")
  const freeAt = ship.data?.free_shipping_threshold ?? 0
  const reached = freeAt > 0 && cart.total >= freeAt

  const shipBar =
    freeAt > 0 ? (
      <div className={`mb-3 rounded-lg p-3 ${reached ? "bg-success/10" : "bg-primary/5"}`}>
        <p className="flex items-center gap-2 text-xs font-medium text-ink/80">
          <Truck className={`h-4 w-4 shrink-0 ${reached ? "text-success" : "text-primary"}`} aria-hidden="true" />
          {reached
            ? fr ? "Livraison offerte" : "Free delivery"
            : fr ? `Plus que ${formatPrice(freeAt - cart.total)} pour la livraison offerte` : `Only ${formatPrice(freeAt - cart.total)} more for free delivery`}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-all duration-500 ${reached ? "bg-success" : "bg-primary"}`}
            style={{ width: `${Math.min(100, (cart.total / freeAt) * 100)}%` }}
          />
        </div>
      </div>
    ) : null

  const helpBtn = WHATSAPP_NUMBER ? (
    <button
      type="button"
      onClick={() => openWaDesk({ kind: "cart", lines: cart.items.map((i) => `${i.title} × ${i.quantity}`), total: formatPrice(cart.total) })}
      className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg text-sm font-semibold text-[#0f6b4a] hover:underline active:opacity-70"
    >
      {fr ? "Besoin d'aide pour commander ?" : "Need help ordering?"}
    </button>
  ) : null

  const summary = (
    <>
      {shipBar}
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
        <button type="button" data-tour="cart-clear" onClick={() => void clearAll()} className="text-sm text-muted underline hover:text-danger">
          {t("cart.clear", { defaultValue: "Vider le panier" })}
        </button>
      </div>
      {undoBar}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul ref={listRef} data-tour="cart-list" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {cart.items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex gap-3 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line">
                  <ProductImage src={item.image_url} alt={item.title} compact fit="contain" />
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
                      data-tour="cart-remove" aria-label={t("cart.remove")}
                      onClick={() => void removeItem(item.type, item.id, item.quantity)}
                      className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger active:scale-95"
                    >
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-sm text-muted">{formatPrice(item.unit_price)}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center overflow-hidden rounded-lg border border-line bg-surface" role="group" data-tour="cart-qty" aria-label={t("ux.quantity")}>
                      <button
                        type="button"
                        aria-label={t("cart.decrease")}
                        disabled={item.quantity <= 1}
                        onClick={() => void run(() => update(item.type, item.id, item.quantity - 1))}
                        className={qtyBtn}
                      >
                        <Minus className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center font-medium" aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={t("cart.increase")}
                        onClick={() => void run(() => update(item.type, item.id, item.quantity + 1))}
                        className={qtyBtn}
                      >
                        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="font-bold text-primary">{formatPrice(item.line_total)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <section data-tour="cart-summary-m" className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card lg:hidden">{summary}{helpBtn}</section>
        </div>

        <aside data-tour="cart-summary" className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          <h2 className="mb-3 font-semibold">{t("cart.summary")}</h2>
          {summary}{helpBtn}
          <Link to="/commande" data-tour="cart-checkout" className={buttonClass({ full: true, size: "lg", className: "mt-4" })}>
            {t("cart.checkout")}
          </Link>
        </aside>
      </div>

      <div className="mt-10">
        <Suggestions excludeIds={cart.items.map((i) => i.id)} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="text-xs text-muted">{t("cart.total")}</p>
            <p className="text-xl font-extrabold text-primary">{formatPrice(cart.total)}</p>
          </div>
          <Link to="/commande" data-tour="cart-checkout-m" className={buttonClass({ full: true, size: "lg", className: "flex-1" })}>
            {t("cart.order")}
          </Link>
        </div>
      </div>
    </div>
  )
}