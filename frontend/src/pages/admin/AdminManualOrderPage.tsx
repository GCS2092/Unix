import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { shopApi, SOURCES, PAYMENT_METHODS } from "../../api/shop"
import { shippingApi } from "../../api/shipping"
import { formatPrice } from "../../lib/format"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import SegmentedControl from "../../components/SegmentedControl"
import type { Product } from "../../types"

interface Line { product: Product; quantity: string; unit: string }

const SOURCE_L: Record<string, [string, string]> = {
  whatsapp: ["WhatsApp", "WhatsApp"], phone: ["Téléphone", "Phone"], shop: ["En boutique", "In store"], other: ["Autre", "Other"],
}
const PAY_L: Record<string, [string, string]> = {
  cash: ["Espèces", "Cash"], wave: ["Wave", "Wave"], orange_money: ["Orange Money", "Orange Money"], free_money: ["Free Money", "Free Money"],
  card: ["Carte", "Card"], transfer: ["Virement", "Transfer"], other: ["Autre", "Other"],
}

const field = "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"

export default function AdminManualOrderPage() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()

  const [name, setName] = useState(params.get("name") ?? "")
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [phone, setPhone] = useState(params.get("phone") ?? "")
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [method, setMethod] = useState<"delivery" | "pickup">("pickup")
  const [zone, setZone] = useState("")
  const [feeEdit, setFeeEdit] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [address, setAddress] = useState("")
  const [landmark, setLandmark] = useState("")
  const [note, setNote] = useState("")
  const [source, setSource] = useState("whatsapp")
  const [payMethod, setPayMethod] = useState("cash")
  const [paid, setPaid] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(id)
  }, [input])

  const results = useQuery({
    queryKey: ["admin-products-search", q],
    queryFn: async () => (await shopApi.searchProducts(q)).data.data,
    staleTime: 30_000,
  })
  const shipping = useQuery({ queryKey: ["shipping"], queryFn: async () => (await shippingApi.get()).data.data })

  const zones = shipping.data?.zones ?? []
  const zoneKey = zone || zones[0]?.key || ""
  const delivery = method === "delivery"
  const baseFee = !shipping.data ? 0 : delivery ? (zones.find((z) => z.key === zoneKey)?.fee ?? 0) : shipping.data.pickup_fee
  const fee = feeEdit.trim() !== "" ? Number(feeEdit) || 0 : baseFee
  const subtotal = lines.reduce((n, l) => n + (Number(l.unit) || 0) * (Number(l.quantity) || 0), 0)
  const total = subtotal + fee

  function addProduct(p: Product) {
    setLines((cur) =>
      cur.some((l) => l.product.id === p.id)
        ? cur.map((l) => (l.product.id === p.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l))
        : [...cur, { product: p, quantity: "1", unit: String(p.price) }],
    )
  }
  const patchLine = (id: number, v: Partial<Line>) => setLines((cur) => cur.map((l) => (l.product.id === id ? { ...l, ...v } : l)))
  const removeLine = (id: number) => setLines((cur) => cur.filter((l) => l.product.id !== id))

  const create = useMutation({
    mutationFn: () =>
      shopApi.createManualOrder({
        guest_name: name.trim() || undefined,
        guest_email: email.trim() || undefined,
        phone: phone.trim(),
        items: lines.map((l) => ({ product_id: l.product.id, quantity: Number(l.quantity), unit_price: Number(l.unit) })),
        delivery_method: method,
        delivery_zone: delivery ? zoneKey : undefined,
        delivery_fee: feeEdit.trim() !== "" ? Number(feeEdit) : undefined,
        city: delivery ? city.trim() : undefined,
        district: delivery ? district.trim() || undefined : undefined,
        address: delivery ? address.trim() : undefined,
        landmark: delivery ? landmark.trim() || undefined : undefined,
        note: note.trim() || undefined,
        source,
        payment_method: payMethod,
        paid,
      }),
    onSuccess: async (res) => {
      toast.success(L("Commande créée.", "Order created."))
      await Promise.all(["admin-orders", "admin-dashboard", "admin-nav-badge", "admin-stock", "admin-customers"].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      navigate(`/admin/boutique/commandes?q=${res.data.data.id}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (lines.length === 0) return toast.error(L("Ajoutez au moins un produit.", "Add at least one product."))
    if (lines.some((l) => !(Number(l.quantity) >= 1))) return toast.error(L("Quantité invalide.", "Invalid quantity."))
    if (!name.trim() && !email.trim()) return toast.error(L("Indiquez le nom du client.", "Enter the customer name."))
    create.mutate()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/admin/boutique/commandes" className="text-sm font-semibold text-primary">← {L("Commandes", "Orders")}</Link>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">{L("Nouvelle commande", "New order")}</h1>
        <p className="text-sm text-muted">{L("Pour une vente prise par WhatsApp, téléphone ou en boutique.", "For a sale taken via WhatsApp, phone or in store.")}</p>
      </div>

      <section data-tour="mo-customer" className={`${card} space-y-3`}>
        <h2 className="font-semibold">{L("Client", "Customer")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{L("Nom", "Name")}
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </label>
          <label className="block text-sm font-medium">{L("Téléphone", "Phone")}
            <input className={field} type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 123 45 67" />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">{L("E-mail (facultatif)", "Email (optional)")}
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-muted">{L("Sans e-mail, aucun message automatique n'est envoyé au client.", "Without an email, no automatic message is sent to the customer.")}</span>
          </label>
        </div>
      </section>

      <section data-tour="mo-products" className={`${card} space-y-3`}>
        <h2 className="font-semibold">{L("Produits", "Products")}</h2>
        <input className={field} type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={L("Rechercher un produit à ajouter", "Search a product to add")} />
        {results.data && results.data.length > 0 && (
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
            {results.data.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addProduct(p)} className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-page">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted">{formatPrice(p.price)} · {L("stock", "stock")} {p.stock ?? "—"}{p.is_published === false ? ` · ${L("masqué", "hidden")}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.product.id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{l.product.name}</p>
                  <button type="button" onClick={() => removeLine(l.product.id)} className="text-xs font-semibold text-danger hover:underline">{L("Retirer", "Remove")}</button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium">{L("Quantité", "Quantity")}
                    <input className={field} type="number" min={1} step={1} inputMode="numeric" value={l.quantity} onChange={(e) => patchLine(l.product.id, { quantity: e.target.value })} />
                  </label>
                  <label className="block text-xs font-medium">{L("Prix unitaire (FCFA)", "Unit price (FCFA)")}
                    <input className={field} type="number" min={0} step={1} inputMode="numeric" value={l.unit} onChange={(e) => patchLine(l.product.id, { unit: e.target.value })} />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-tour="mo-delivery" className={`${card} space-y-3`}>
        <h2 className="font-semibold">{L("Livraison", "Delivery")}</h2>
        <SegmentedControl
          label={L("Mode", "Method")}
          value={method}
          onChange={(v) => setMethod(v as "delivery" | "pickup")}
          options={[{ value: "pickup", label: L("Retrait", "Pickup") }, { value: "delivery", label: L("Livraison", "Delivery") }]}
        />
        {delivery && (
          <div className="space-y-3">
            {zones.length > 0 && (
              <SegmentedControl
                label={L("Zone", "Zone")}
                value={zoneKey}
                onChange={setZone}
                options={zones.map((z) => ({ value: z.key, label: `${(fr ? z.label_fr : z.label_en) || z.key} · ${formatPrice(z.fee)}` }))}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">{L("Ville", "City")}<input className={field} required value={city} onChange={(e) => setCity(e.target.value)} /></label>
              <label className="block text-sm font-medium">{L("Quartier", "District")}<input className={field} value={district} onChange={(e) => setDistrict(e.target.value)} /></label>
              <label className="block text-sm font-medium">{L("Adresse", "Address")}<input className={field} required value={address} onChange={(e) => setAddress(e.target.value)} /></label>
              <label className="block text-sm font-medium">{L("Point de repère", "Landmark")}<input className={field} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></label>
            </div>
          </div>
        )}
        <label className="block text-sm font-medium sm:max-w-xs">{L("Frais (laisser vide = tarif standard)", "Fee (empty = standard rate)")}
          <input className={field} type="number" min={0} step={1} inputMode="numeric" value={feeEdit} onChange={(e) => setFeeEdit(e.target.value)} placeholder={String(baseFee)} />
        </label>
      </section>

      <section data-tour="mo-payment" className={`${card} space-y-3`}>
        <h2 className="font-semibold">{L("Origine et paiement", "Source and payment")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{L("Canal de vente", "Sales channel")}
            <select className={field} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_L[s][fr ? 0 : 1]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">{L("Moyen de paiement", "Payment method")}
            <select className={field} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYMENT_METHODS.map((s) => <option key={s} value={s}>{PAY_L[s][fr ? 0 : 1]}</option>)}
            </select>
          </label>
        </div>
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          {L("Déjà payée (facture émise tout de suite)", "Already paid (invoice issued right away)")}
        </label>
        {!paid && <p className="text-xs text-muted">{L("Le stock est réservé sans limite de temps. Marquez la commande payée depuis la liste quand le paiement arrive.", "Stock is reserved with no time limit. Mark the order as paid from the list when payment arrives.")}</p>}
        <label className="block text-sm font-medium">{L("Note de commande (facultatif)", "Order note (optional)")}
          <textarea className={field} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </section>

      <section data-tour="mo-total" className={`${card} space-y-1 text-sm`}>
        <p className="flex justify-between text-muted"><span>{L("Sous-total", "Subtotal")}</span><span>{formatPrice(subtotal)}</span></p>
        <p className="flex justify-between text-muted"><span>{L("Livraison", "Delivery")}</span><span>{formatPrice(fee)}</span></p>
        <p className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span className="text-primary">{formatPrice(total)}</span></p>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0 lg:rounded-b-card">
        <Link to="/admin/boutique/commandes" className="flex min-h-[48px] items-center rounded-lg border border-line px-5 text-sm font-semibold hover:bg-page">{L("Annuler", "Cancel")}</Link>
        <Button type="submit" size="lg" className="flex-1" loading={create.isPending} disabled={lines.length === 0}>
          {L("Créer la commande", "Create order")}
        </Button>
      </div>
    </form>
  )
}
