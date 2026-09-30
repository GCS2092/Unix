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

const qtyBtn =
  "flex h-10 w-10 items-center justify-center rounded-lg border border-line text-lg font-semibold transition hover:bg-page active:scale-95 active:bg-line/60 disabled:opacity-40"

export default function CartPage() {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const loaded = useCartStore((s) => s.loaded)
  const cart = useCartStore((s) => s.cart)
  const update = useCartStore((s) => s.update)
  const remove = useCartStore((s) => s.remove)

  async function run(action: () => Promise<void>, okMessage?: string) {
    try {
      await action()
      if (okMessage) toast.info(okMessage)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (!loaded) return <ListSkeleton />

  if (cart.items.length === 0) {
    return (
      <div className="py-8 text-center">
        <EmptyState message={t("cart.empty")} />
        <Link to="/boutique" className={buttonClass({ size: "lg" })}>{t("cart.go_shop")}</Link>
      </div>
    )
  }

  return (
    <div className="pb-28 lg:pb-0">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("cart.title")}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card lg:col-span-2">
          {cart.items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line"><ProductImage src={item.image_url} alt={item.title} compact /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted">
                    {formatPrice(item.unit_price)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("cart.remove")}
                  onClick={() => void run(() => remove(item.type, item.id), t("cart.removed"))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger active:scale-95"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {(
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("cart.decrease")}
                      disabled={item.quantity <= 1}
                      onClick={() => void run(() => update(item.type, item.id, item.quantity - 1))}
                      className={qtyBtn}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={t("cart.increase")}
                      onClick={() => void run(() => update(item.type, item.id, item.quantity + 1))}
                      className={qtyBtn}
                    >
                      +
                    </button>
                  </div>
                )}
                <p className="font-bold">{formatPrice(item.line_total)}</p>
              </div>
            </li>
          ))}
        </ul>

        <aside className="sticky top-24 hidden h-fit rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          <h2 className="font-semibold">{t("cart.summary")}</h2>
          <p className="mt-3 flex justify-between text-lg font-bold">
            <span>{t("cart.total")}</span>
            <span className="text-primary">{formatPrice(cart.total)}</span>
          </p>
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