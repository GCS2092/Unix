import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { checkoutApi } from "../api/checkout"
import { formatPrice } from "../lib/format"
import { statusBadgeClass } from "../lib/orderStatus"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { EmptyState, ErrorState, LoadingState } from "../components/States"
import Button from "../components/Button"
import { buttonClass } from "../components/buttonStyles"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import type { ApiResource } from "../types"

interface CheckoutStatus {
  order_id: number
  public_ref?: string | null
  status: string
  status_label: string
  total: number
  currency: string
  is_paid: boolean
  is_failed: boolean
}

const POLL_MS = 5_000
const POLL_MAX_MS = 3 * 60_000

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function CheckoutReturnPage() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const [params] = useSearchParams()
  const transactionId = params.get("transaction_id")
  const manual = params.get("manual") === "1"
  const user = useAuthStore((s) => s.user)
  const fetchCart = useCartStore((s) => s.fetch)
  const [timedOut, setTimedOut] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: order, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["checkout-status", transactionId],
    enabled: !!transactionId,
    queryFn: async () =>
      (await checkoutApi.status<ApiResource<CheckoutStatus>>(transactionId as string)).data.data,
    // Le webhook peut arriver après le retour du client : on interroge, mais pas indéfiniment
    refetchInterval: (query) => {
      const d = query.state.data
      return d && !d.is_paid && !d.is_failed && !manual && !timedOut ? POLL_MS : false
    },
    staleTime: 0,
  })

  const waiting = !!order && !order.is_paid && !order.is_failed

  useEffect(() => {
    if (!waiting || manual || timedOut) return
    const id = setTimeout(() => setTimedOut(true), POLL_MAX_MS)
    return () => clearTimeout(id)
  }, [waiting, manual, timedOut])

  useEffect(() => {
    if (order?.is_paid) void fetchCart().catch(() => undefined)
  }, [order?.is_paid, fetchCart])

  if (!transactionId) {
    return <EmptyState message={t("return.not_found")} actionTo="/boutique" actionLabel={t("cart.go_shop")} />
  }
  if (isLoading) return <LoadingState />
  if (!order) return <ErrorState error={error} onRetry={() => void refetch()} />

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="mb-3 text-2xl font-bold">{t("orders.order_no", { id: order.order_id })}</h1>
      {order.public_ref && (
        <div className="mb-4 rounded-lg bg-primary/5 px-3 py-2 text-sm">
          <p className="text-muted">{fr ? "Votre identifiant de suivi" : "Your tracking reference"}</p>
          <p className="font-mono text-lg font-bold tracking-wider text-ink">{order.public_ref}</p>
          <p className="mt-1 text-xs text-muted">{fr ? "Conservez-le : il permet de suivre votre commande sans compte." : "Keep it: it lets you track your order without an account."}</p>
        </div>
      )}
      {(() => {
        let tk = ""
        try { tk = sessionStorage.getItem("track:" + transactionId) ?? "" } catch { tk = "" }
        if (!tk) return null
        const link = `${window.location.origin}/suivi/${tk}`
        const text = fr
          ? `Bonjour, voici ma commande ${order.public_ref ?? "#" + order.order_id}. Suivi : ${link}`
          : `Hello, here is my order ${order.public_ref ?? "#" + order.order_id}. Tracking: ${link}`
        return (
          <div className="mb-4 rounded-lg border border-line bg-surface p-3 text-left text-sm">
            <p className="font-semibold">{fr ? "Votre lien de suivi" : "Your tracking link"}</p>
            <p className="mt-1 break-all text-xs text-muted">{link}</p>
            <p className="mt-1 text-xs text-muted">{fr ? "Gardez-le : il donne acc\u00e8s \u00e0 votre commande et \u00e0 votre facture, sans compte ni e-mail. Ne le partagez pas." : "Keep it: it gives access to your order and invoice, with no account or email. Do not share it."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}>
                {copied ? (fr ? "Copi\u00e9 !" : "Copied!") : (fr ? "Copier le lien" : "Copy link")}
              </Button>
              {WHATSAPP_NUMBER && (
                <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "sm", variant: "ghost" })}>
                  {fr ? "Envoyer \u00e0 la boutique sur WhatsApp" : "Send to the shop on WhatsApp"}
                </a>
              )}
            </div>
          </div>
        )
      })()}
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(order.status)}`}>
        {t(`status.${order.status}`, { defaultValue: order.status_label })}
      </span>
      <p className="mt-3 text-lg font-semibold">{formatPrice(order.total, order.currency)}</p>

      <div role="status" aria-live="polite" className="mt-6 space-y-3">
        {order.is_paid && <p className="font-medium text-success">{t("return.paid")}</p>}
        {order.is_failed && <p className="text-danger">{t("return.failed")}</p>}
        {waiting && manual && <p className="text-muted">{t("return.reserved")}</p>}
        {waiting && !manual && !timedOut && (
          <p className="flex items-center justify-center gap-2 text-muted"><Spinner />{t("return.pending")}</p>
        )}
        {waiting && !manual && timedOut && (
          <div className="rounded-card border border-line bg-surface p-4 text-left text-sm shadow-card">
            <p>
              {t("return.timeout", {
                defaultValue: "La confirmation prend plus de temps que prévu. Inutile de payer à nouveau : la commande sera mise à jour dès que le paiement sera confirmé.",
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={isFetching} onClick={() => { setTimedOut(false); void refetch() }}>
                {t("return.check_again", { defaultValue: "Vérifier maintenant" })}
              </Button>
              {WHATSAPP_NUMBER && (
                <a
                  href={whatsappUrl(`Bonjour, ma commande n°${order.order_id} est en attente de confirmation.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({ size: "sm", variant: "ghost" })}
                >
                  {t("return.contact_us", { defaultValue: "Nous écrire" })}
                </a>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-muted">
            {t("return.refresh_error", { defaultValue: "Mise à jour impossible pour le moment, nouvel essai automatique…" })}
          </p>
        )}
      </div>

      <div className="mt-8">
        {user ? (
          <Link to="/commandes" className={buttonClass()}>{t("return.view_orders")}</Link>
        ) : (
          <Link to="/boutique" className={buttonClass({ variant: "secondary" })}>{t("cart.go_shop")}</Link>
        )}
      </div>
    </div>
  )
}