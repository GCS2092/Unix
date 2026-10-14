import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"
import BrandSettingsForm from "./BrandSettingsForm"
import CommunicationSettingsForm from "./CommunicationSettingsForm"
import ShippingZonesForm from "./ShippingZonesForm"
import ShopSettingsForm from "./ShopSettingsForm"
import PaymentSettingsForm from "./PaymentSettingsForm"

type Key = keyof AdminSettings

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Record<Key, string>>({
    pickup_fee: String(initial.pickup_fee),
    low_stock_threshold: String(initial.low_stock_threshold),
  })

  const fields: { key: Key; label: string; hint?: string }[] = [
    { key: "pickup_fee", label: t("admin.set_pickup_fee", { defaultValue: "Frais de retrait sur place (FCFA)" }) },
    {
      key: "low_stock_threshold",
      label: t("admin.set_low_stock", { defaultValue: "Seuil de stock faible" }),
      hint: t("admin.set_low_stock_hint", { defaultValue: "Les produits à ce niveau ou en dessous apparaissent dans le tableau de bord." }),
    },
  ]

  const save = useMutation({
    mutationFn: () => {
      const payload = {} as AdminSettings
      for (const f of fields) {
        const n = Number(form[f.key])
        if (!Number.isInteger(n) || n < 0) throw new Error(t("admin.set_invalid", { defaultValue: "Chaque valeur doit être un nombre entier positif." }))
        payload[f.key] = n
      }
      return adminApi.updateSettings(payload)
    },
    onSuccess: async () => {
      toast.success(t("admin.saved", { defaultValue: "Enregistré" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      await queryClient.invalidateQueries({ queryKey: ["shipping"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="font-semibold">{t("admin.set_fees_title", { defaultValue: "Frais et stock" })}</h3>
      {fields.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="font-medium">{f.label}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form[f.key]}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
        </label>
      ))}
      <Button loading={save.isPending} onClick={() => save.mutate()}>
        {t("admin.save")}
      </Button>
    </div>
  )
}

function FeesSettings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await adminApi.settings()).data.data,
    staleTime: 0,
  })
  return (
    <>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <SettingsForm key={JSON.stringify(data)} initial={data} />}
    </>
  )
}

interface SectionDef {
  key: string
  title: [string, string]
  desc: [string, string]
  render: () => ReactNode
}

const SECTIONS: SectionDef[] = [
  {
    key: "identite",
    title: ["Identité", "Identity"],
    desc: ["Le nom de la boutique, utilisé partout : site, e-mails et factures.", "The shop name, used everywhere: site, emails and invoices."],
    render: () => <BrandSettingsForm />,
  },
  {
    key: "commandes",
    title: ["Commandes et stock", "Orders and stock"],
    desc: ["Frais, minimums, livraison offerte et réservation du stock.", "Fees, minimums, free delivery and stock reservation."],
    render: () => (
      <div className="space-y-6">
        <FeesSettings />
        <ShopSettingsForm parts={[1, 2]} />
      </div>
    ),
  },
  {
    key: "livraison",
    title: ["Livraison", "Delivery"],
    desc: ["Zones de livraison et tarifs associés.", "Delivery zones and their fees."],
    render: () => <ShippingZonesForm />,
  },
  {
    key: "paiement",
    title: ["Paiement", "Payment"],
    desc: ["Num\u00e9ros et consignes affich\u00e9s au client pour payer une commande.", "Numbers and instructions shown to customers to pay an order."],
    render: () => <PaymentSettingsForm />,
  },
  {
    key: "facturation",
    title: ["Facturation", "Invoicing"],
    desc: ["Identité légale et mentions affichées sur les factures.", "Legal identity and details shown on invoices."],
    render: () => <ShopSettingsForm parts={[0]} />,
  },
  {
    key: "vitrine",
    title: ["Vitrine", "Storefront"],
    desc: ["Horaires, réseaux sociaux, CGV et expéditeur des e-mails. Les réseaux renseignés s'affichent dans le pied de page de la boutique.", "Opening hours, social links, terms and email sender. Links you fill in appear in the shop footer."],
    render: () => <ShopSettingsForm parts={[3]} />,
  },
  {
    key: "contact",
    title: ["Contact et retrait", "Contact and pickup"],
    desc: ["Coordonnées de support et conditions de retrait sur place.", "Support details and in-store pickup rules."],
    render: () => <CommunicationSettingsForm parts={[0, 1]} />,
  },
  {
    key: "messages",
    title: ["E-mails et suivi", "Emails and tracking"],
    desc: ["Messages clients, bandeau de la page de suivi et options d'envoi.", "Customer messages, tracking banner and sending options."],
    render: () => <CommunicationSettingsForm parts={[2, 3, 4]} />,
  },
]

// Reperes de la visite guidee (un nom par barre : mobile "-m", bureau sans suffixe)
function tourName(key: string, suffix: string) {
  if (key === "commandes") return `set-fees${suffix}`
  if (key === "messages") return `set-comm${suffix}`
  return undefined
}

export default function AdminSettingsPage() {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const [params, setParams] = useSearchParams()
  const active = SECTIONS.find((s) => s.key === params.get("section")) ?? SECTIONS[0]
  const label = (s: SectionDef) => (fr ? s.title[0] : s.title[1])

  function select(key: string) {
    setParams({ section: key }, { replace: true })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("admin.settings", { defaultValue: "Paramètres" })}</h2>

      <nav aria-label={t("admin.settings", { defaultValue: "Paramètres" })} className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
        {SECTIONS.map((s) => {
          const on = s.key === active.key
          return (
            <button
              key={s.key}
              type="button"
              data-tour={tourName(s.key, "-m")}
              aria-current={on ? "page" : undefined}
              onClick={() => select(s.key)}
              className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition active:scale-[0.97] ${
                on ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {label(s)}
            </button>
          )
        })}
      </nav>

      <div className="lg:flex lg:gap-8">
        <nav aria-label={t("admin.settings", { defaultValue: "Paramètres" })} className="hidden w-56 shrink-0 lg:block">
          <ul className="sticky top-8 space-y-1">
            {SECTIONS.map((s) => {
              const on = s.key === active.key
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    data-tour={tourName(s.key, "")}
                    aria-current={on ? "page" : undefined}
                    onClick={() => select(s.key)}
                    className={`flex min-h-[44px] w-full items-center rounded-lg border-l-4 px-3 text-left text-sm font-semibold transition ${
                      on
                        ? "border-primary bg-primary-light/60 text-primary-dark"
                        : "border-transparent text-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {label(s)}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section key={active.key} className="min-w-0 flex-1 animate-fade-up">
          <header className="mb-5">
            <h3 className="text-lg font-semibold">{label(active)}</h3>
            <p className="text-sm text-muted">{fr ? active.desc[0] : active.desc[1]}</p>
          </header>
          {active.render()}
        </section>
      </div>
    </div>
  )
}