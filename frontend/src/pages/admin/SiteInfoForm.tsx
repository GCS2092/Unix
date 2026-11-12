import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { siteInfoApi } from "../../api/siteInfo"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import { SaveBar } from "../../components/admin/SettingsUi"

const inputClass =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

type Kind = "text" | "textarea" | "toggle" | "number" | "email" | "methods" | "trust" | "select"
type Pair = [string, string]
interface Opt { v: string; l: Pair }
interface Field { key: string; kind: Kind; label: Pair; hint?: Pair; max?: number; options?: Opt[] }
interface Group { title: Pair; fields: Field[] }

const METHODS: Opt[] = [
  { v: "wave", l: ["Wave", "Wave"] },
  { v: "orange_money", l: ["Orange Money", "Orange Money"] },
  { v: "free_money", l: ["Free Money", "Free Money"] },
  { v: "transfer", l: ["Virement bancaire", "Bank transfer"] },
  { v: "cash", l: ["Espèces (livraison ou retrait)", "Cash (delivery or pickup)"] },
  { v: "card", l: ["Carte / paiement en ligne (CinetPay)", "Card / online payment (CinetPay)"] },
]

const GROUPS: Group[] = [
  {
    title: ["Identité", "Identity"],
    fields: [
      { key: "brand_colors", kind: "text", max: 120, label: ["Couleurs de la marque", "Brand colors"], hint: ["Ex. : Bleu #0B4A6F, ou « couleurs du logo ».", "E.g. Blue #0B4A6F, or “logo colors”."] },
      { key: "trust_points", kind: "trust", label: ["3 arguments de confiance (accueil)", "3 trust points (home)"] },
      { key: "mail_from_address", kind: "email", max: 190, label: ["Adresse e-mail d'envoi", "Sending email address"], hint: ["Adresse d'où partent les e-mails de commande.", "Address order emails are sent from."] },
    ],
  },
  {
    title: ["WhatsApp", "WhatsApp"],
    fields: [
      { key: "whatsapp_staff", kind: "text", max: 200, label: ["Qui répond et à quelles heures", "Who answers and when"], hint: ["Ex. : Fatou, du lundi au samedi, 8h–20h. Le numéro se règle dans Contact et retrait.", "E.g. Fatou, Mon–Sat, 8am–8pm. The number is set in Contact and pickup."] },
      { key: "whatsapp_message_fr", kind: "text", max: 300, label: ["Message prérempli (français)", "Prefilled message (French)"] },
      { key: "whatsapp_message_en", kind: "text", max: 300, label: ["Message prérempli (anglais)", "Prefilled message (English)"] },
    ],
  },
  {
    title: ["TVA et retrait", "VAT and pickup"],
    fields: [
      { key: "vat_enabled", kind: "toggle", label: ["TVA applicable sur les factures", "VAT applies on invoices"] },
      { key: "vat_rate", kind: "number", label: ["Taux de TVA (%)", "VAT rate (%)"] },
      { key: "pickup_enabled", kind: "toggle", label: ["Retrait sur place proposé", "In-store pickup offered"] },
    ],
  },
  {
    title: ["Moyens de paiement", "Payment methods"],
    fields: [
      { key: "payment_methods", kind: "methods", label: ["Moyens de paiement acceptés", "Accepted payment methods"], hint: ["Les numéros se saisissent dans l'onglet Paiement.", "Numbers are entered in the Payment tab."] },
      {
        key: "cinetpay_status", kind: "select", label: ["Compte CinetPay", "CinetPay account"],
        options: [
          { v: "open", l: ["Compte ouvert et validé", "Account open and validated"] },
          { v: "to_open", l: ["Compte à ouvrir", "Account to open"] },
          { v: "none", l: ["Pas de paiement en ligne", "No online payment"] },
        ],
      },
    ],
  },
  {
    title: ["Formations", "Courses"],
    fields: [
      { key: "certificate_condition", kind: "text", max: 160, label: ["Condition pour obtenir le certificat", "Condition to get the certificate"], hint: ["Ex. : avoir suivi 100 % du cours.", "E.g. completed 100% of the course."] },
      { key: "certificate_mention_fr", kind: "text", max: 255, label: ["Mention sur le certificat (français)", "Certificate wording (French)"] },
      { key: "certificate_mention_en", kind: "text", max: 255, label: ["Mention sur le certificat (anglais)", "Certificate wording (English)"] },
      { key: "live_schedule", kind: "text", max: 255, label: ["Planning des directs", "Live sessions schedule"], hint: ["Ex. : tous les jeudis à 18h.", "E.g. every Thursday at 6pm."] },
      {
        key: "live_audience", kind: "select", label: ["Qui peut rejoindre un direct ?", "Who can join a live?"],
        options: [
          { v: "enrolled", l: ["Élèves inscrits au cours", "Students enrolled in the course"] },
          { v: "invited", l: ["Invités sur invitation", "Invited guests"] },
        ],
      },
    ],
  },
]

type Item = { ok: boolean; label: Pair; section: string }

function Checklist() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const [, setParams] = useSearchParams()
  const shop = useQuery({ queryKey: ["admin-shop-settings"], queryFn: async () => (await adminApi.shopSettings()).data.data, staleTime: 0 })
  const comms = useQuery({ queryKey: ["admin-comms"], queryFn: async () => (await adminApi.communicationSettings()).data.data, staleTime: 0 })
  if (!shop.data || !comms.data) return null
  const s = shop.data
  const c = comms.data
  const items: Item[] = [
    { ok: !!c.shop_name, label: ["Nom de la boutique", "Shop name"], section: "identite" },
    { ok: !!c.support_whatsapp, label: ["Numéro WhatsApp", "WhatsApp number"], section: "contact" },
    { ok: !!c.support_email, label: ["E-mail de contact client", "Customer contact email"], section: "contact" },
    { ok: !!s.legal_name, label: ["Nom légal", "Legal name"], section: "facturation" },
    { ok: !!s.ninea, label: ["NINEA", "NINEA"], section: "facturation" },
    { ok: !!s.rccm, label: ["RCCM", "RCCM"], section: "facturation" },
    { ok: !!s.terms_url, label: ["Lien des CGV", "Terms of sale link"], section: "vitrine" },
    { ok: !!((c as unknown as Record<string, string>).pay_wave || (c as unknown as Record<string, string>).pay_orange_money), label: ["Numéro Wave ou Orange Money", "Wave or Orange Money number"], section: "paiement" },
  ]
  const missing = items.filter((i) => !i.ok)
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="font-semibold">{fr ? "Avant la mise en ligne" : "Before launch"}</h3>
      {missing.length === 0 ? (
        <p className="text-sm text-success">{fr ? "Tous les champs obligatoires sont renseignés." : "All required fields are filled in."}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{fr ? `${missing.length} champ(s) obligatoire(s) à compléter :` : `${missing.length} required field(s) left:`}</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <button key={m.label[0]} type="button" onClick={() => setParams({ section: m.section }, { replace: true })}
                className="min-h-[36px] rounded-full border border-danger/40 px-3 text-xs font-semibold text-danger hover:bg-danger/10">
                {fr ? m.label[0] : m.label[1]}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Form({ initial }: { initial: Record<string, unknown> }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (p: Pair) => (fr ? p[0] : p[1])
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, unknown>>(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const str = (k: string) => String(form[k] ?? "")
  const set = (k: string, v: unknown) => setForm((s) => ({ ...s, [k]: v }))
  const methods = (form.payment_methods as string[] | undefined) ?? []
  const trust = ((form.trust_points as { fr: string; en: string }[] | undefined) ?? []).concat([{ fr: "", en: "" }, { fr: "", en: "" }, { fr: "", en: "" }]).slice(0, 3)

  const save = useMutation({
    mutationFn: () => siteInfoApi.save({ ...form, trust_points: trust.filter((t) => t.fr || t.en) }),
    onSuccess: async () => {
      toast.success(L(["Enregistré", "Saved"]))
      await qc.invalidateQueries({ queryKey: ["admin-site-info"] })
      await qc.invalidateQueries({ queryKey: ["public-site-info"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-2xl space-y-4">
      <Checklist />
      {GROUPS.map((g) => (
        <section key={g.title[0]} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <h3 className="font-semibold">{L(g.title)}</h3>
          {g.fields.map((f) => {
            const hint = f.hint && <span className="mt-1 block text-xs text-muted">{L(f.hint)}</span>
            if (f.kind === "toggle")
              return (
                <label key={f.key} className="flex min-h-[44px] items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={Boolean(form[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                  <span>{L(f.label)}</span>
                </label>
              )
            if (f.kind === "methods")
              return (
                <fieldset key={f.key} className="space-y-1">
                  <legend className="text-sm font-medium">{L(f.label)}</legend>
                  {METHODS.map((m) => (
                    <label key={m.v} className="flex min-h-[40px] items-center gap-3 text-sm">
                      <input type="checkbox" className="h-5 w-5" checked={methods.includes(m.v)}
                        onChange={(e) => set("payment_methods", e.target.checked ? [...methods, m.v] : methods.filter((x) => x !== m.v))} />
                      {L(m.l)}
                    </label>
                  ))}
                  {hint}
                </fieldset>
              )
            if (f.kind === "trust")
              return (
                <fieldset key={f.key} className="space-y-2">
                  <legend className="text-sm font-medium">{L(f.label)}</legend>
                  {trust.map((t, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-2">
                      <input className={inputClass} maxLength={80} placeholder={fr ? `Argument ${i + 1} (français)` : `Point ${i + 1} (French)`} value={t.fr}
                        onChange={(e) => set("trust_points", trust.map((x, j) => (j === i ? { ...x, fr: e.target.value } : x)))} />
                      <input className={inputClass} maxLength={80} placeholder={fr ? `Argument ${i + 1} (anglais)` : `Point ${i + 1} (English)`} value={t.en}
                        onChange={(e) => set("trust_points", trust.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
                    </div>
                  ))}
                  <span className="block text-xs text-muted">{fr ? "Vide = arguments actuels conservés." : "Empty = current points kept."}</span>
                </fieldset>
              )
            if (f.kind === "select")
              return (
                <label key={f.key} className="block text-sm">
                  <span className="font-medium">{L(f.label)}</span>
                  <select className={inputClass} value={str(f.key)} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {f.options?.map((o) => <option key={o.v} value={o.v}>{L(o.l)}</option>)}
                  </select>
                </label>
              )
            return (
              <label key={f.key} className="block text-sm">
                <span className="font-medium">{L(f.label)}</span>
                <input
                  className={inputClass}
                  type={f.kind === "number" ? "number" : f.kind === "email" ? "email" : "text"}
                  min={f.kind === "number" ? 0 : undefined}
                  max={f.kind === "number" ? 100 : undefined}
                  maxLength={f.max}
                  value={str(f.key)}
                  onChange={(e) => set(f.key, f.kind === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                />
                {hint}
              </label>
            )
          })}
        </section>
      ))}
      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onCancel={() => setForm(initial)} />
    </div>
  )
}

export default function SiteInfoForm() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-site-info"],
    queryFn: async () => (await siteInfoApi.admin()).data.data,
    staleTime: 0,
  })
  return (
    <div>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <Form key={JSON.stringify(data)} initial={data} />}
    </div>
  )
}