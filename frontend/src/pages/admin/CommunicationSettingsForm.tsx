import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type CommunicationSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import { SaveBar } from "../../components/admin/SettingsUi"

type Key = keyof CommunicationSettings
type Kind = "text" | "email" | "textarea" | "number" | "toggle" | "emails"
interface Field {
  key: Key
  kind: Kind
  label: string
  hint?: string
  max?: number
}
interface Section {
  title: string
  fields: Field[]
}

const inputClass =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

function Form({ initial, parts }: { initial: CommunicationSettings; parts?: number[] }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CommunicationSettings>(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const admins = initial.admin_accounts ?? []
  const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
  function toggleEmail(key: Key, email: string) {
    const list = splitEmails(String(form[key] ?? ""))
    const e = email.toLowerCase()
    setValue(key, (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]).join(", "))
  }

  const sections: Section[] = [
    {
      title: L("Contact de support", "Support contact"),
      fields: [
        { key: "support_email", kind: "email", label: L("E-mail de support", "Support email"), max: 120 },
        {
          key: "support_whatsapp",
          kind: "text",
          label: L("WhatsApp de support", "Support WhatsApp"),
          hint: "+221 77 123 45 67",
          max: 20,
        },
      ],
    },
    {
      title: L("Retrait sur place", "Pickup"),
      fields: [
        {
          key: "pickup_place",
          kind: "text",
          label: L("Lieu de retrait par d\u00e9faut", "Default pickup location"),
          hint: L("La note de retrait saisie sur la commande reste prioritaire.", "The pickup note set on the order takes priority."),
          max: 200,
        },
        { key: "pickup_hours", kind: "text", label: L("Horaires de retrait", "Pickup hours"), max: 200 },
        {
          key: "pickup_requirements",
          kind: "text",
          label: L("\u00c0 pr\u00e9senter au retrait", "What to bring for pickup"),
          hint: L("Ex. : pi\u00e8ce d'identit\u00e9 et identifiant de commande.", "E.g. ID and order reference."),
          max: 300,
        },
      ],
    },
    {
      title: L("E-mails clients", "Customer emails"),
      fields: [
        {
          key: "prep_days",
          kind: "number",
          label: L("D\u00e9lai de pr\u00e9paration estim\u00e9 (jours)", "Estimated preparation time (days)"),
          hint: L("0 = ne pas afficher.", "0 = do not show."),
        },
        {
          key: "default_warranty_months",
          kind: "number",
          label: L("Garantie par d\u00e9faut (mois)", "Default warranty (months)"),
          hint: L("Pr\u00e9remplie dans le suivi d'une commande. 0 = aucune.", "Prefilled on the order tracking form. 0 = none."),
        },
        { key: "message_fr", kind: "textarea", label: L("Message personnalis\u00e9 (fran\u00e7ais)", "Custom message (French)"), max: 500 },
        { key: "message_en", kind: "textarea", label: L("Message personnalis\u00e9 (anglais)", "Custom message (English)"), max: 500 },
      ],
    },
    {
      title: L("Page de suivi", "Tracking page"),
      fields: [
        {
          key: "announcement_fr",
          kind: "text",
          label: L("Bandeau d'annonce (fran\u00e7ais)", "Announcement banner (French)"),
          hint: L("Laissez vide pour ne rien afficher.", "Leave empty to show nothing."),
          max: 200,
        },
        { key: "announcement_en", kind: "text", label: L("Bandeau d'annonce (anglais)", "Announcement banner (English)"), max: 200 },
      ],
    },
    {
      title: L("Options", "Options"),
      fields: [
        { key: "attach_invoice", kind: "toggle", label: L("Joindre la facture PDF \u00e0 l'e-mail de confirmation", "Attach the PDF invoice to the confirmation email") },
        {
          key: "send_stage_emails",
          kind: "toggle",
          label: L("Envoyer un e-mail \u00e0 chaque \u00e9tape (pr\u00e9paration, exp\u00e9dition, retrait, livraison)", "Send an email at each step (preparing, shipped, pickup, delivered)"),
        },
        { key: "invite_account_cta", kind: "toggle", label: L("Proposer aux invit\u00e9s de cr\u00e9er un compte", "Invite guests to create an account") },
      ],
    },
    {
      title: L("Alertes \u00e9quipe", "Team alerts"),
      fields: [
        { key: "send_admin_alerts", kind: "toggle", label: L("Envoyer des alertes e-mail \u00e0 l'\u00e9quipe", "Send email alerts to the team") },
        { key: "send_admin_alert_paid", kind: "toggle", label: L("Alerte : nouvelle commande pay\u00e9e en ligne", "Alert: new order paid online") },
        {
          key: "admin_alert_paid_to",
          kind: "emails",
          label: L("Qui re\u00e7oit l'alerte \u00ab commande pay\u00e9e \u00bb", "Who receives the \u201cpaid order\u201d alert"),
          hint: L("Cliquez sur un nom ou saisissez des adresses s\u00e9par\u00e9es par une virgule. Vide = adresse par d\u00e9faut ci-dessous.", "Click a name or type comma-separated addresses. Empty = default address below."),
        },
        { key: "send_admin_alert_stock", kind: "toggle", label: L("Alerte : conflit de stock", "Alert: stock conflict") },
        {
          key: "admin_alert_stock_to",
          kind: "emails",
          label: L("Qui re\u00e7oit l'alerte \u00ab conflit de stock \u00bb", "Who receives the \u201cstock conflict\u201d alert"),
          hint: L("Vide = adresse par d\u00e9faut ci-dessous.", "Empty = default address below."),
        },
        {
          key: "admin_alert_email",
          kind: "emails",
          label: L("Adresse par d\u00e9faut des alertes", "Default alert address"),
          hint: L("Vide aussi = tous les comptes administrateurs re\u00e7oivent les alertes.", "Also empty = every administrator account receives the alerts."),
        },
      ],
    },
  ]

  function setValue(key: Key, value: string | number | boolean) {
    setForm((s) => ({ ...s, [key]: value }) as CommunicationSettings)
  }

  const save = useMutation({
    mutationFn: () => adminApi.updateCommunicationSettings(form),
    onSuccess: async () => {
      toast.success(t("admin.saved", { defaultValue: "Enregistr\u00e9" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-comms"] })
      await queryClient.invalidateQueries({ queryKey: ["public-shop"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-2xl space-y-4">
      {sections.filter((_, i) => !parts || parts.includes(i)).map((s) => (
        <section key={s.title} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <h3 className="font-semibold">{s.title}</h3>
          {s.fields.map((f) =>
            f.kind === "emails" ? (
              <div key={f.key} className="block text-sm">
                <label htmlFor={`f-${f.key}`} className="font-medium">{f.label}</label>
                <input
                  id={`f-${f.key}`}
                  type="text"
                  maxLength={500}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  placeholder="nom@domaine.com, autre@domaine.com"
                  className={inputClass}
                />
                {admins.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {admins.map((a) => {
                      const on = splitEmails(String(form[f.key] ?? "")).includes(a.email.toLowerCase())
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={on}
                          title={a.email}
                          onClick={() => toggleEmail(f.key, a.email)}
                          className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:bg-page"}`}
                        >
                          {on ? "\u2713 " : "+ "}{a.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
              </div>
            ) : f.kind === "toggle" ? (
              <label key={f.key} className="flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[f.key])}
                  onChange={(e) => setValue(f.key, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-primary,#2563eb)]"
                />
                <span>{f.label}</span>
              </label>
            ) : (
              <label key={f.key} className="block text-sm">
                <span className="font-medium">{f.label}</span>
                {f.kind === "textarea" ? (
                  <textarea
                    rows={3}
                    maxLength={f.max}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    className={inputClass}
                  />
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : f.kind === "email" ? "email" : "text"}
                    min={f.kind === "number" ? 0 : undefined}
                    max={f.kind === "number" ? 120 : undefined}
                    maxLength={f.max}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setValue(f.key, f.kind === "number" ? Number(e.target.value || 0) : e.target.value)}
                    className={inputClass}
                  />
                )}
                {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
              </label>
            ),
          )}
        </section>
      ))}
      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onCancel={() => setForm(initial)} />
    </div>
  )
}

export default function CommunicationSettingsForm({ parts }: { parts?: number[] }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-comms"],
    queryFn: async () => (await adminApi.communicationSettings()).data.data,
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