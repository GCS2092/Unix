import { useEffect, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import Button from "./Button"
import { formatPrice } from "../lib/format"
import type { MarkPaidPayload } from "../api/admin"
import type { AdminOrder } from "../types"

const MARK_PAID_METHODS = ["cash", "wave", "orange_money", "free_money", "transfer", "card", "other"] as const

const field = "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

interface Props {
  order: AdminOrder | null
  pending: boolean
  error: string | null
  onSubmit: (payload: MarkPaidPayload) => void
  onClose: () => void
}

export default function MarkPaidDialog({ order, pending, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<string>("cash")
  const [reference, setReference] = useState("")
  const [amount, setAmount] = useState(order ? String(order.total) : "")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!order) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [order, pending, onClose])

  if (!order) return null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (pending || !order) return
    setLocalError(null)

    const payload: MarkPaidPayload = { payment_method: method }
    const ref = reference.trim()
    if (ref) payload.payment_reference = ref

    if (amount.trim() !== "") {
      const n = Number(amount)
      if (!Number.isInteger(n) || n < 0) return setLocalError(t("admin.pay_amount_invalid"))
      if (n < order.total) return setLocalError(t("admin.pay_amount_low"))
      payload.amount_received = n
    }
    onSubmit(payload)
  }

  const shown = localError ?? error

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="markpaid-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-card border border-line bg-surface p-5 shadow-card-lg sm:max-w-md sm:rounded-card"
      >
        <h2 id="markpaid-title" className="text-lg font-bold">{t("admin.pay_title")} #{order.id}</h2>
        <p className="mt-1 text-sm text-muted">{formatPrice(order.total, order.currency)}</p>
        <p className="mt-2 text-sm text-muted">{t("admin.pay_intro")}</p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">{t("admin.pay_method")}
            <select className={field} value={method} onChange={(e) => setMethod(e.target.value)} disabled={pending}>
              {MARK_PAID_METHODS.map((m) => (
                <option key={m} value={m}>{t(`admin.pay_method_${m}`)}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">{t("admin.pay_reference")}
            <input className={field} value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder={t("admin.pay_reference_ph")} disabled={pending} />
          </label>

          <label className="block text-sm font-medium">{t("admin.pay_amount")}
            <input className={field} type="number" min={0} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={pending} />
            <span className="mt-1 block text-xs font-normal text-muted">{t("admin.pay_amount_hint")}</span>
          </label>
        </div>

        {shown && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{shown}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="flex min-h-[48px] items-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-page disabled:opacity-50">
            {t("admin.cancel")}
          </button>
          <Button type="submit" size="lg" className="flex-1" loading={pending} disabled={pending}>
            {t("admin.pay_confirm")}
          </Button>
        </div>
      </form>
    </div>
  )
}