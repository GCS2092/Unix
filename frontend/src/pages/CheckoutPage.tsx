import { DEFAULT_COUNTRY } from "../api/account"
import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Check, ChevronDown, ShoppingBag } from "lucide-react"
import { checkoutApi } from "../api/checkout"
import { shippingApi } from "../api/shipping"
import { usePublicShop } from "../hooks/usePublicShop"
import { useAuthStore } from "../stores/authStore"
import { useCartStore } from "../stores/cartStore"
import { useCurrencyStore } from "../stores/currencyStore"
import { toast } from "../stores/toastStore"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { formatMoney } from "../lib/currency"
import { getErrorMessage } from "../lib/errors"
import { loadContact, saveContact } from "../lib/savedContact"
import { isEmail, isPhone, isName, hasLetters, normalizePhone, suggestEmail, msg } from "../lib/validate"
import { accountApi, type Address } from "../api/account"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"
import SegmentedControl from "../components/SegmentedControl"
import Button from "../components/Button"
import { buttonClass } from "../components/buttonStyles"
import BackButton from "../components/BackButton"
import ProductImage from "../components/ProductImage"
import { Field, inputCls } from "../components/Field"
import { PhoneField } from "../components/PhoneField"

const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"

function Stepper({ step, labels, ariaLabel }: { step: number; labels: string[]; ariaLabel: string }) {
  return (
    <ol data-tour="co-stepper" className="mb-6 flex items-center" aria-label={ariaLabel}>
      {labels.map((label, i) => {
        const n = i + 1
        const done = n < step
        const current = n === step
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                done ? "bg-primary text-white" : current ? "bg-primary text-white ring-4 ring-primary/20" : "bg-line text-muted"
              }`}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : n}
            </span>
            <span className={`ml-2 text-xs font-semibold sm:text-sm ${current ? "text-ink" : "hidden text-muted sm:inline"}`}>{label}</span>
            {n < labels.length && (
              <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded bg-line">
                <span className={`block h-full bg-primary transition-all duration-500 ${done ? "w-full" : "w-0"}`} />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function CheckoutPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith("fr")
  const L = (fr: string, en: string) => (isFr ? fr : en)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const fetchCart = useCartStore((s) => s.fetch)
  const formatPrice = useFormatPrice()
  const currency = useCurrencyStore((s) => s.currency)
  const user = useAuthStore((s) => s.user)
  const cart = useCartStore((s) => s.cart)
  const loaded = useCartStore((s) => s.loaded)
  const cartError = useCartStore((s) => s.error)

  const [saved] = useState(loadContact)
  const [email, setEmail] = useState("")
  const [name, setName] = useState(saved.name ?? user?.name ?? "")
  const [phone, setPhone] = useState(saved.phone ?? "")
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery")
  const [zone, setZone] = useState("")
  const [city, setCity] = useState(saved.city ?? "")
  const [district, setDistrict] = useState(saved.district ?? "")
  const [address, setAddress] = useState(saved.address ?? "")
  const [landmark, setLandmark] = useState(saved.landmark ?? "")
  const [note, setNote] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [saveAddr, setSaveAddr] = useState(false)
  const [addrId, setAddrId] = useState("")
  const [tried1, setTried1] = useState(false)
  const [tried2, setTried2] = useState(false)
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await accountApi.addresses()).data.data,
    enabled: !!user,
  })
  function applyAddress(a: Address) {
    setAddrId(String(a.id))
    setName(a.recipient_name)
    setPhone(a.phone)
    setMethod("delivery")
    setCity(a.city)
    setDistrict(a.district ?? "")
    setAddress(a.address)
    setLandmark(a.landmark ?? "")
  }
  function clearAddress() {
    setAddrId("")
    setName(user?.name ?? "")
    setPhone("")
    setCity("")
    setDistrict("")
    setAddress("")
    setLandmark("")
  }
  const { data: me } = useQuery({
    queryKey: ["account-me"],
    queryFn: async () => (await accountApi.me()).data.user,
    enabled: !!user,
  })
  const [prefilled, setPrefilled] = useState(false)
  // Client connecte : le compte est la source de verite (adresse par defaut,
  // sinon nom + telephone du profil). Le stockage local ne sert que de secours.
  if (user && !prefilled && addresses && me) {
    setPrefilled(true)
    const d = addresses.find((x) => x.is_default)
    if (d) {
      applyAddress(d)
    } else {
      setName(me.name)
      if (me.phone) setPhone(me.phone)
    }
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: shipping, isError: shippingError, refetch: refetchShipping } = useQuery({
    queryKey: ["shipping"],
    queryFn: async () => (await shippingApi.get()).data.data,
  })
  const { data: pub } = usePublicShop()
  const pickupLines = [
    pub?.pickup_place ? `${isFr ? "Lieu de retrait" : "Pickup place"} : ${pub.pickup_place}` : "",
    pub?.pickup_hours ? `${isFr ? "Horaires" : "Hours"} : ${pub.pickup_hours}` : "",
    pub?.pickup_requirements ? `${isFr ? "À présenter" : "Bring"} : ${pub.pickup_requirements}` : "",
  ].filter(Boolean)
  const zones = shipping?.zones ?? []
  const zoneKey = zone || zones[0]?.key || ""
  const delivery = method === "delivery"
  const rawFee = !shipping ? 0 : method === "pickup" ? shipping.pickup_fee : (zones.find((z) => z.key === zoneKey)?.fee ?? 0)
  const freeAt = shipping?.free_shipping_threshold ?? 0
  const fee = delivery && freeAt > 0 && cart.total >= freeAt ? 0 : rawFee
  const minOrder = shipping?.min_order ?? 0
  const belowMin = minOrder > 0 && cart.total < minOrder
  const grandTotal = cart.total + fee

  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const xofTotal = formatMoney(grandTotal, "XOF", { XOF: 1 }, locale)

  // Validation
  const emailError = !isEmail(email) ? (email.trim() === "" ? L("Entrez votre email", "Enter your email") : L("Email invalide", "Invalid email")) : null
  const phoneError = !isPhone(phone) ? (phone.trim() === "" ? L("Entrez votre numéro", "Enter your phone number") : msg.phone()) : null
  const cityError = city.trim() === "" ? L("Indiquez votre ville", "Enter your city") : !hasLetters(city) ? msg.city() : null
  const addressError = address.trim() === "" ? L("Indiquez votre adresse", "Enter your address") : address.trim().length < 5 || !hasLetters(address) ? msg.address() : null
  const nameError = !isName(name) ? (name.trim() === "" ? L("Entrez votre nom", "Enter your name") : msg.name()) : null
  const emailSuggestion = !user && !emailError ? suggestEmail(email) : null

  // Etape courante (dans l'URL pour que le bouton "retour" du navigateur fonctionne)
  const valid1 = (!!user || !emailError) && !phoneError && !nameError
  const valid2 = !delivery || (!cityError && !addressError)
  const urlStep = Math.min(3, Math.max(1, Number(params.get("etape")) || 1))
  const step = !valid1 ? 1 : urlStep >= 3 && !valid2 ? 2 : urlStep

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  function go(n: number) {
    setParams({ etape: String(n) })
  }

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await checkoutApi.start({
        guest_email: user ? undefined : email.trim().toLowerCase(),
        guest_name: name.trim() || undefined,
        phone: normalizePhone(phone),
        delivery_method: method,
        delivery_zone: delivery ? zoneKey : undefined,
        city: delivery ? city : undefined,
        district: delivery ? district || undefined : undefined,
        address: delivery ? address : undefined,
        landmark: delivery ? landmark || undefined : undefined,
        note: note || undefined,
        accept_terms: accepted,
      })
      saveContact({ name, phone, city, district, address, landmark })
      if (user && delivery && saveAddr && !addrId) {
        await accountApi
          .createAddress({ label: city, recipient_name: name || user.name, phone, country: DEFAULT_COUNTRY, city, district, address, landmark, is_default: false })
          .catch(() => undefined)
      }
      if (data.payment_url) {
        window.location.assign(data.payment_url)
      } else {
        const manualTarget = data.payment_pending_manual
          ? user ? `/commandes/${data.data.id}` : data.track_token ? `/suivi/${data.track_token}` : null
          : null
        navigate(manualTarget ?? `/commande/retour?transaction_id=${encodeURIComponent(data.transaction_id)}&manual=1`, { replace: true })
        void fetchCart().catch(() => undefined)
      }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error(message)
      setLoading(false)
    }
  }

  if (!loaded) return <ListSkeleton />

  if (cartError && cart.items.length === 0) {
    return <ErrorState error={cartError} onRetry={() => void fetchCart().catch(() => undefined)} />
  }

  if (cart.items.length === 0) {
    return (
      <div className="py-8 text-center">
        <EmptyState message={t("cart.empty")} />
        <Link to="/boutique" className={buttonClass({ size: "lg" })}>{t("cart.go_shop")}</Link>
      </div>
    )
  }

  const titles = [t("co.contact_title"), t("checkout.delivery_title"), t("co.review_title")]
  const hints = [t("co.contact_hint"), t("co.delivery_hint"), t("co.review_hint")]
  const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("checkout.title")}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{t("co.step_of", { current: step, total: 3 })}</p>

      <Stepper
        step={step}
        ariaLabel={t("co.steps_label")}
        labels={[t("co.step_contact"), t("co.step_delivery"), t("co.step_payment")]}
      />

      {step < 3 && (
        <details className={`${card} group mb-4`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("checkout.your_cart")} ({itemCount})
            </span>
            <span className="flex items-center gap-2 text-primary">
              {formatPrice(cart.total)}
              <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
            {cart.items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line"><ProductImage src={item.image_url} alt="" compact /></div>
                  <span className="min-w-0 truncate">{item.title} × {item.quantity}</span>
                </div>
                <span className="whitespace-nowrap font-medium">{formatPrice(item.line_total)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div key={step} data-tour="co-step" className="animate-fade-up">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{titles[step - 1]}</h2>
          <p className="text-sm text-muted">{hints[step - 1]}</p>
        </div>

        {step === 1 && (
          <form
            noValidate
            onSubmit={(e) => { e.preventDefault(); setTried1(true); if (valid1) go(2) }}
            className={`${card} space-y-4`}
          >
            {user && addresses && addresses.length > 0 && (
              <label className="block text-sm font-medium">
                {t("px.checkout.deliver_to")}
                <select
                  value={addrId}
                  onChange={(e) => {
                    const a = addresses.find((x) => String(x.id) === e.target.value)
                    if (a) applyAddress(a)
                    else clearAddress()
                  }}
                  className={inputCls}
                >
                  <option value="">{t("px.checkout.other_address")}</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>{(a.label || a.recipient_name) + " \u2013 " + a.city}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  {t("px.checkout.edit_hint")}
                </span>
              </label>
            )}
            {!user && (
              <Field
                label={t("checkout.email")}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={setEmail}
                error={emailError}
                suggestion={emailSuggestion}
                suggestionLabel={msg.didYouMean()}
                forceShow={tried1}
              />
            )}
            <Field
              label={t("checkout.name")}
              type="text"
              autoComplete="name"
              value={name}
              onChange={setName}
              required
              error={nameError}
              forceShow={tried1}
            />
            <PhoneField
              label={t("checkout.phone")}
              required
              value={phone}
              onChange={setPhone}
              error={phoneError}
              forceShow={tried1}
              hint={L("Pour vous joindre lors de la livraison", "So we can reach you for delivery")}
            />
            <div className="flex gap-3 pt-2">
              <Link to="/panier" className={buttonClass({ variant: "secondary", size: "lg" })}>{t("co.to_cart")}</Link>
              <Button type="submit" size="lg" className="flex-1">{t("co.next")}</Button>
            </div>
          </form>
        )}

        {step === 2 && shippingError && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{t("checkout.shipping_error", { defaultValue: "Impossible de charger les frais de livraison." })}</span>
            <button type="button" onClick={() => void refetchShipping()} className="font-semibold underline">{t("states.retry")}</button>
          </div>
        )}

        {step === 2 && (
          <form
            noValidate
            onSubmit={(e) => { e.preventDefault(); setTried2(true); if (valid2) go(3) }}
            className={`${card} space-y-4`}
          >
            <SegmentedControl
              label={t("checkout.delivery_title")}
              value={method}
              onChange={(v) => setMethod(v as "delivery" | "pickup")}
              options={[
                { value: "delivery", label: t("checkout.method_delivery") },
                { value: "pickup", label: t("checkout.method_pickup") },
              ]}
            />
            {!delivery && pickupLines.length > 0 && (
              <div className="rounded-lg border border-line bg-page p-3 text-sm">
                {pickupLines.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}
            {delivery && (
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
                        label: ((i18n.language.startsWith("en") ? z.label_en : z.label_fr) || t(`checkout.zone_${z.key}`, { defaultValue: z.key })) + " · " + formatPrice(z.fee),
                      }))}
                    />
                  </div>
                )}
                <Field label={t("checkout.city")} type="text" required autoComplete="address-level2" value={city} onChange={setCity} error={cityError} forceShow={tried2} />
                <Field label={t("checkout.district")} optional={t("co.optional")} type="text" value={district} onChange={setDistrict} />
                <Field label={t("checkout.address")} type="text" required autoComplete="street-address" value={address} onChange={setAddress} error={addressError} forceShow={tried2} />
                <Field label={t("checkout.landmark")} optional={t("co.optional")} type="text" value={landmark} onChange={setLandmark}
                  hint={L("Ex. : en face de la pharmacie, près de la mosquée", "E.g. across from the pharmacy")} />
              </>
            )}
            <label className="block text-sm font-medium">
              {t("checkout.note")} <span className="font-normal text-muted">({t("co.optional")})</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </label>
            <div className="flex gap-3 pt-2">
              <BackButton onClick={() => go(1)} label={t("co.back")} />
              <Button type="submit" size="lg" className="flex-1">{t("co.next")}</Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={(e) => void pay(e)} className="space-y-4">
            <section className={card}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{t("checkout.your_cart")}</h3>
              <ul className="divide-y divide-line text-sm">
                {cart.items.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line"><ProductImage src={item.image_url} alt="" compact /></div><span className="min-w-0 truncate">{item.title} × {item.quantity}</span></div>
                    <span className="whitespace-nowrap font-medium">{formatPrice(item.line_total)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${card} space-y-3 text-sm`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t("co.step_contact")}</p>
                  <p className="truncate text-muted">{[name, user?.email ?? email, phone].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" onClick={() => go(1)} className="min-h-[44px] shrink-0 px-2 font-semibold text-primary hover:underline">{t("co.edit")}</button>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="font-semibold">{delivery ? t("co.delivery_label") : t("co.pickup_label")}</p>
                  {delivery && <p className="text-muted">{[address, landmark, district, city].filter(Boolean).join(", ")}</p>}
                  {!delivery && pickupLines.map((l) => <p key={l} className="text-muted">{l}</p>)}
                  {note && <p className="mt-1 text-muted">« {note} »</p>}
                </div>
                <button type="button" onClick={() => go(2)} className="min-h-[44px] shrink-0 px-2 font-semibold text-primary hover:underline">{t("co.edit")}</button>
              </div>
            </section>

            <section data-tour="co-total" className={`${card} space-y-1 text-sm`}>
              <p className="flex justify-between text-muted">
                <span>{t("checkout.subtotal")}</span>
                <span>{formatPrice(cart.total)}</span>
              </p>
              <p className="flex justify-between text-muted">
                <span>{t("checkout.delivery_fee")}</span>
                <span className={fee === 0 ? "font-medium text-success" : ""}>{fee === 0 ? t("checkout.free") : formatPrice(fee)}</span>
              </p>
              <p className="flex justify-between border-t border-line pt-2 text-lg font-bold">
                <span>{t("cart.total")}</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </p>
              {currency !== "XOF" && <p className="text-xs text-muted">{t("checkout.xof_note", { amount: xofTotal })}</p>}
            </section>

            {user && delivery && !addrId && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="mt-1" />
                <span>{t("px.checkout.save_address")}</span>
              </label>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
              <span>{t("checkout.accept_terms")}</span>
            </label>
            {error && (
              <div role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                <p>{error}</p>
                <Link to="/panier" className="mt-1 inline-block font-semibold underline">{t("co.to_cart")}</Link>
              </div>
            )}
            <div className="flex gap-3">
              <BackButton onClick={() => go(2)} label={t("co.back")} disabled={loading} />
              <Button type="submit" size="lg" className="flex-1" loading={loading} disabled={!accepted || !shipping || belowMin}>
                {loading ? t("checkout.redirecting") : t("checkout.pay")}
              </Button>
            </div>
            {belowMin && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {isFr ? `Commande minimale : ${formatPrice(minOrder)}.` : `Minimum order: ${formatPrice(minOrder)}.`}
              </p>
            )}
            {delivery && freeAt > 0 && cart.total < freeAt && (
              <p className="text-center text-xs text-muted">
                {isFr ? `Plus que ${formatPrice(freeAt - cart.total)} pour la livraison offerte.` : `Only ${formatPrice(freeAt - cart.total)} more for free delivery.`}
              </p>
            )}
            <p className="text-center text-xs text-muted">{t("checkout.secure")}</p>
          </form>
        )}
      </div>
    </div>
  )
}

