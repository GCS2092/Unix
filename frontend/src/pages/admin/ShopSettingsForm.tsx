import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type ShopSettingsData } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import { SaveBar } from "../../components/admin/SettingsUi"

type Key = keyof ShopSettingsData
type Kind = "text" | "email" | "url" | "textarea" | "number"
interface Field { key: Key; kind: Kind; label: string; hint?: string; max?: number; min?: number }
interface Section { title: string; fields: Field[] }

const inputClass =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

function Form({ initial, parts }: { initial: ShopSettingsData; parts?: number[] }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [form, setForm] = useState<ShopSettingsData>(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const sections: Section[] = [
    {
      title: L("Identité et facturation", "Identity and invoicing"),
      fields: [
        { key: "legal_name", kind: "text", label: L("Nom légal (en-tête des factures)", "Legal name (invoice header)"), max: 120 },
        { key: "legal_address", kind: "text", label: L("Adresse", "Address"), max: 255 },
        { key: "legal_phone", kind: "text", label: L("Téléphone", "Phone"), max: 40 },
        { key: "legal_email", kind: "email", label: L("E-mail", "Email"), max: 120 },
        { key: "ninea", kind: "text", label: "NINEA", max: 40 },
        { key: "rccm", kind: "text", label: "RCCM", max: 60 },
        {
          key: "invoice_footer", kind: "textarea", max: 300,
          label: L("Mentions de bas de facture", "Invoice footer"),
          hint: L("S'applique aux nouvelles factures. Les factures déjà émises ne changent pas.", "Applies to new invoices. Issued invoices do not change."),
        },
      ],
    },
    {
      title: L("Commandes et livraison", "Orders and delivery"),
      fields: [
        {
          key: "min_order", kind: "number", min: 0, label: L("Montant minimum de commande (FCFA)", "Minimum order amount (FCFA)"),
          hint: L("0 = pas de minimum.", "0 = no minimum."),
        },
        {
          key: "free_shipping_threshold", kind: "number", min: 0, label: L("Livraison offerte à partir de (FCFA)", "Free delivery from (FCFA)"),
          hint: L("0 = désactivé. S'applique au sous-total, en livraison à domicile.", "0 = off. Applies to the subtotal, for home delivery."),
        },
      ],
    },
    {
      title: L("Paiement et stock", "Payment and stock"),
      fields: [
        {
          key: "reservation_minutes", kind: "number", min: 5, max: 1440,
          label: L("Durée de réservation du stock (minutes)", "Stock reservation time (minutes)"),
          hint: L("Délai laissé au client pour payer avant que les articles soient remis en vente.", "Time the customer has to pay before items go back on sale."),
        },
      ],
    },
    {
      title: L("Contenu public", "Public content"),
      fields: [
        { key: "mail_from_name", kind: "text", label: L("Nom d'expéditeur des e-mails", "Email sender name"), max: 80 },
        { key: "opening_hours", kind: "text", label: L("Horaires d'ouverture", "Opening hours"), max: 200 },
        { key: "social_facebook", kind: "url", label: "Facebook (URL)", max: 255 },
        { key: "social_instagram", kind: "url", label: "Instagram (URL)", max: 255 },
        { key: "social_tiktok", kind: "url", label: "TikTok (URL)", max: 255 },
        { key: "terms_url", kind: "url", label: L("Lien des conditions générales de vente", "Terms of sale link"), max: 255 },
      ],
    },
  ]

  function setValue(key: Key, value: string | number) {
    setForm((s) => ({ ...s, [key]: value }) as ShopSettingsData)
  }

  const save = useMutation({
    mutationFn: () => adminApi.updateShopSettings(form),
    onSuccess: async () => {
      toast.success(L("Enregistré", "Saved"))
      await qc.invalidateQueries({ queryKey: ["admin-shop-settings"] })
      await qc.invalidateQueries({ queryKey: ["shipping"] })
      await qc.invalidateQueries({ queryKey: ["public-shop"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-2xl space-y-4">
      {sections.filter((_, i) => !parts || parts.includes(i)).map((s) => (
        <section key={s.title} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <h3 className="font-semibold">{s.title}</h3>
          {s.fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="font-medium">{f.label}</span>
              {f.kind === "textarea" ? (
                <textarea rows={3} maxLength={f.max} value={String(form[f.key] ?? "")} onChange={(e) => setValue(f.key, e.target.value)} className={inputClass} />
              ) : (
                <input
                  type={f.kind === "number" ? "number" : f.kind}
                  inputMode={f.kind === "number" ? "numeric" : undefined}
                  min={f.kind === "number" ? f.min : undefined}
                  max={f.kind === "number" ? f.max : undefined}
                  maxLength={f.kind === "number" ? undefined : f.max}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setValue(f.key, f.kind === "number" ? Number(e.target.value || 0) : e.target.value)}
                  className={inputClass}
                />
              )}
              {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
            </label>
          ))}
        </section>
      ))}
      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onCancel={() => setForm(initial)} />
    </div>
  )
}

export default function ShopSettingsForm({ parts }: { parts?: number[] }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-shop-settings"],
    queryFn: async () => (await adminApi.shopSettings()).data.data,
    staleTime: 0,
  })

  return (
    <div>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <Form key={JSON.stringify(data)} initial={data} parts={parts} />}
    </div>
  )
}