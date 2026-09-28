import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { checkoutApi } from "../api/checkout"
import { shippingApi } from "../api/shipping"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { useCurrencyStore } from "../stores/currencyStore"
import { toast } from "../stores/toastStore"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { formatMoney } from "../lib/currency"
import { getErrorMessage } from "../lib/errors"
import { EmptyState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import SegmentedControl from "../components/SegmentedControl"
import Button, { buttonClass } from "../components/Button"

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

export default function CheckoutPage() {
  const { t, i18n } = useTranslation()
  const formatPrice = useFormatPrice()
  const currency = useCurrencyStore((s) => s.currency)
  const user = useAuthStore((s) => s.user)
  const cart = useCartStore((s) => s.cart)
  const loaded = useCartStore((s) => s.loaded)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery")
  const [zone, setZone] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [address, setAddress] = useState("")
  const [landmark, setLandmark] = useState("")
  const [note, setNote] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const physical = cart.items.some((i) => i.type === "product")
  const { data: shipping } = useQuery({
    queryKey: ["shipping"],
    queryFn: async () => (await shippingApi.get()).data.data,
    enabled: physical,
  })
  const zones = shipping?.zones ?? []
  const zoneKey = zone || zones[0]?.key || ""
  const fee = !physical || !shipping ? 0 : method === "pickup" ? shipping.pickup_fee : (zones.find((z) => z.key === zoneKey)?.fee ?? 0)
  const grandTotal = cart.total + fee

  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const xofTotal = formatMoney(grandTotal, "XOF", { XOF: 1 }, locale)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const delivery = physical && method === "delivery"
    try {
      const { data } = await checkoutApi.start({
        guest_email: user ? undefined : email,
        guest_name: name || undefined,
        phone: phone || undefined,
        delivery_method: physical ? method : undefined,
        delivery_zone: delivery ? zoneKey : undefined,
        city: delivery ? city : undefined,
        district: delivery ? district || undefined : undefined,
        address: delivery ? address : undefined,
        landmark: delivery ? landmark || undefined : undefined,
        note: note || undefined,
        accept_terms: accepted,
      })
      window.location.assign(data.payment_url)
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error(message)
      setLoading(false)
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
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t("checkout.title")}</h1>

      <section className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-muted">{t("checkout.your_cart")}</h2>
        <ul className="divide-y divide-line text-sm">
          {cart.items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="flex justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{item.title} × {item.quantity}</span>
              <span className="whitespace-nowrap font-medium">{formatPrice(item.line_total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        {!user && (
          <label className="block text-sm font-medium">
            {t("checkout.email")}
            <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
        )}
        <label className="block text-sm font-medium">
          {t("checkout.name")}
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("checkout.phone")}
          <input type="tel" required autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>

        {physical && (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-sm font-semibold">{t("checkout.delivery_title")}</p>
            <SegmentedControl
              label={t("checkout.delivery_title")}
              value={method}
              onChange={(v) => setMethod(v as "delivery" | "pickup")}
              options={[
                { value: "delivery", label: t("checkout.method_delivery") },
                { value: "pickup", label: t("checkout.method_pickup") },
              ]}
            />
            {method === "delivery" && (
              <>
                {zones.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("checkout.zone")}</p>
                    <SegmentedControl
                      label={t("checkout.zone")}
                      value={zoneKey}
                      onChange={setZone}
                      options={zones.map((z) => ({
                        value: z.key,
                        label: t(`checkout.zone_${z.key}`, { defaultValue: z.key }) + " · " + formatPrice(z.fee),
                      }))}
                    />
                  </div>
                )}
                <label className="block text-sm font-medium">
                  {t("checkout.city")}
                  <input type="text" required autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("checkout.district")}
                  <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("checkout.address")}
                  <input type="text" required autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  {t("checkout.landmark")}
                  <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} className={inputClass} />
                </label>
              </>
            )}
          </div>
        )}

        <label className="block text-sm font-medium">
          {t("checkout.note")}
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>

        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <p className="flex justify-between text-muted">
            <span>{t("checkout.subtotal")}</span>
            <span>{formatPrice(cart.total)}</span>
          </p>
          {physical && (
            <p className="flex justify-between text-muted">
              <span>{t("checkout.delivery_fee")}</span>
              <span>{fee === 0 ? t("checkout.free") : formatPrice(fee)}</span>
            </p>
          )}
          <p className="flex justify-between pt-1 text-lg font-bold">
            <span>{t("cart.total")}</span>
            <span className="text-primary">{formatPrice(grandTotal)}</span>
          </p>
          {currency !== "XOF" && (
            <p className="text-xs text-muted">{t("checkout.xof_note", { amount: xofTotal })}</p>
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
          <span>{t("checkout.accept_terms")}</span>
        </label>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" full loading={loading} disabled={!accepted}>
          {loading ? t("checkout.redirecting") : t("checkout.pay")}
        </Button>
        <p className="text-center text-xs text-muted">{t("checkout.secure")}</p>
      </form>
    </div>
  )
}