import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type CommunicationSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

type Key = keyof CommunicationSettings
type Kind = "text" | "email" | "textarea" | "number" | "toggle"
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
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"

function Form({ initial }: { initial: CommunicationSettings }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CommunicationSettings>(initial)

  const sections: Section[] = [
    {
      title: L("Boutique et contact", "Shop and contact"),
      fields: [
        { key: "shop_name", kind: "text", label: L("Nom de la boutique", "Shop name"), max: 80 },
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
    <div className="max-w-xl space-y-4">
      {sections.map((s) => (
        <section key={s.title} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <h3 className="font-semibold">{s.title}</h3>
          {s.fields.map((f) =>
            f.kind === "toggle" ? (
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
      <Button loading={save.isPending} onClick={() => save.mutate()}>
        {t("admin.save")}
      </Button>
    </div>
  )
}

export default function CommunicationSettingsForm() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-comms"],
    queryFn: async () => (await adminApi.communicationSettings()).data.data,
    staleTime: 0,
  })

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-xl font-semibold">{fr ? "Communications et suivi" : "Communications and tracking"}</h2>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <Form key={JSON.stringify(data)} initial={data} />}
    </div>
  )
}