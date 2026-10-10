import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useCartStore } from "../stores/cartStore"
import { useDrawerStore } from "../stores/drawerStore"
import { toast } from "../stores/toastStore"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { getErrorMessage } from "../lib/errors"
import { buttonClass } from "./buttonStyles"
import ProductImage from "./ProductImage"
import Suggestions from "./Suggestions"

const qtyBtn =
  "flex h-9 w-9 items-center justify-center text-ink transition hover:bg-page active:bg-line/60 disabled:cursor-default disabled:text-muted/50"

export default function CartDrawer() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const formatPrice = useFormatPrice()
  const { pathname } = useLocation()
  const open = useDrawerStore((s) => s.open)
  const hide = useDrawerStore((s) => s.hide)
  const cart = useCartStore((s) => s.cart)
  const update = useCartStore((s) => s.update)
  const remove = useCartStore((s) => s.remove)

  // Inutile sur le panier et la commande : on y est deja
  const visible = open && !/^\/(panier|commande)/.test(pathname)
  const count = cart.items.reduce((n, i) => n + i.quantity, 0)

  useEffect(() => {
    hide()
  }, [pathname, hide])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [visible, hide])

  async function run(action: () => Promise<void>) {
    try {
      await action()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <>
      {/* Le fond et le tiroir s'arretent au-dessus de la barre du bas (mobile) : elle reste visible */}
      <div
        onClick={hide}
        aria-hidden="true"
        className={`fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[45] bg-ink/40 transition-opacity md:bottom-0 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label={t("cart.title")}
        aria-hidden={!visible}
        inert={!visible}
        className={`fixed right-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[46] flex w-full max-w-sm flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] shadow-card-lg transition-transform duration-200 md:bottom-0 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold">
            {t("cart.title")} <span className="font-normal text-muted">({count})</span>
          </h2>
          <button type="button" onClick={hide} aria-label={t("common.close")} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-page hover:text-ink">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-3">
          {cart.items.length === 0 ? (
            <p className="py-8 text-center text-muted">{t("cart.empty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {cart.items.map((item) => (
                <li key={`${item.type}-${item.id}`} className="flex gap-3 py-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                    <ProductImage src={item.image_url} alt={item.title} compact />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/boutique/${item.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary">{item.title}</Link>
                      <button type="button" aria-label={t("cart.remove")} onClick={() => void run(() => remove(item.type, item.id))} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <div className="flex items-center overflow-hidden rounded-lg border border-line" role="group" aria-label={t("ux.quantity")}>
                        <button type="button" aria-label={t("cart.decrease")} disabled={item.quantity <= 1} onClick={() => void run(() => update(item.type, item.id, item.quantity - 1))} className={qtyBtn}>&minus;</button>
                        <span className="w-7 text-center text-sm font-medium" aria-live="polite">{item.quantity}</span>
                        <button type="button" aria-label={t("cart.increase")} onClick={() => void run(() => update(item.type, item.id, item.quantity + 1))} className={qtyBtn}>+</button>
                      </div>
                      <p className="text-sm font-bold text-primary">{formatPrice(item.line_total)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">
            {visible && <Suggestions variant="list" excludeIds={cart.items.map((i) => i.id)} limit={4} />}
          </div>
        </div>

        {cart.items.length > 0 && (
          <div className="space-y-2 border-t border-line px-4 py-3">
            <p className="flex justify-between text-base font-bold">
              <span>{fr ? "Sous-total" : "Subtotal"}</span>
              <span className="text-primary">{formatPrice(cart.total)}</span>
            </p>
            <Link to="/commande" className={buttonClass({ full: true, size: "lg" })}>{t("cart.order")}</Link>
            <Link to="/panier" className="flex min-h-[44px] items-center justify-center rounded-lg border border-line text-sm font-semibold hover:bg-page">
              {fr ? "Voir le panier" : "View cart"}
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}