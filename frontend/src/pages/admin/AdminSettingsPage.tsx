import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"
import { buttonClass } from "../../components/buttonStyles"
import { Svg } from "../../components/admin/ui"
import BrandSettingsForm from "./BrandSettingsForm"
import CommunicationSettingsForm from "./CommunicationSettingsForm"
import ShippingZonesForm from "./ShippingZonesForm"
import ShopSettingsForm from "./ShopSettingsForm"
import PaymentSettingsForm from "./PaymentSettingsForm"
import AboutSettingsForm from "./AboutSettingsForm"

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
    <div className="max-w-2xl space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
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
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
  icon: string
  preview?: { to: string; label: [string, string] }[]
  render: () => ReactNode
}

const SITE: { to: string; label: [string, string] } = { to: "/", label: ["Voir le site", "View the site"] }

const SECTIONS: SectionDef[] = [
  {
    key: "identite",
    title: ["Identité", "Identity"],
    desc: ["Le nom de la boutique, utilisé partout : site, e-mails et factures.", "The shop name, used everywhere: site, emails and invoices."],
    icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
    preview: [SITE],
    render: () => <BrandSettingsForm />,
  },
  {
    key: "commandes",
    title: ["Commandes et stock", "Orders and stock"],
    desc: ["Frais, minimums, livraison offerte et réservation du stock.", "Fees, minimums, free delivery and stock reservation."],
    icon: "M6 7h12l-1 13H7L6 7zM9 7a3 3 0 016 0",
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
    icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7",
    render: () => <ShippingZonesForm />,
  },
  {
    key: "paiement",
    title: ["Paiement", "Payment"],
    desc: ["Numéros et consignes affichés au client pour payer une commande.", "Numbers and instructions shown to customers to pay an order."],
    icon: "M3 7h18v12H3zM3 11h18M7 15h3",
    render: () => <PaymentSettingsForm />,
  },
  {
    key: "facturation",
    title: ["Facturation", "Invoicing"],
    desc: ["Identité légale et mentions affichées sur les factures.", "Legal identity and details shown on invoices."],
    icon: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
    render: () => <ShopSettingsForm parts={[0]} />,
  },
  {
    key: "vitrine",
    title: ["Vitrine", "Storefront"],
    desc: ["Horaires, réseaux sociaux, CGV et expéditeur des e-mails. Les réseaux renseignés s'affichent dans le pied de page de la boutique.", "Opening hours, social links, terms and email sender. Links you fill in appear in the shop footer."],
    icon: "M3 9l2-5h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6",
    preview: [SITE],
    render: () => <ShopSettingsForm parts={[3]} />,
  },
  {
    key: "contact",
    title: ["Contact et retrait", "Contact and pickup"],
    desc: ["Coordonnées de support et conditions de retrait sur place.", "Support details and in-store pickup rules."],
    icon: "M3 5h18v14H3zM3 7l9 6 9-6",
    render: () => <CommunicationSettingsForm parts={[0, 1]} />,
  },
  {
    key: "messages",
    title: ["E-mails et suivi", "Emails and tracking"],
    desc: ["Messages clients, bandeau de la page de suivi et options d'envoi.", "Customer messages, tracking banner and sending options."],
    icon: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
    render: () => <CommunicationSettingsForm parts={[2, 3, 4]} />,
  },
  {
    key: "apropos",
    title: ["À propos et réseaux", "About and social"],
    desc: ["Bannières, images, textes et liens de l'accueil et de la page À propos.", "Banners, images, texts and links of the home and About pages."],
    icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01",
    preview: [
      { to: "/decouvrir", label: ["Voir la page À propos", "View the About page"] },
      SITE,
    ],
    render: () => <AboutSettingsForm />,
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
    <div className="pb-28">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("admin.settings", { defaultValue: "Paramètres" })}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {fr ? "Réglez votre boutique, vos contenus publics et vos communications." : "Configure your shop, public content and communications."}
        </p>
      </div>

      <nav aria-label={t("admin.settings", { defaultValue: "Paramètres" })} data-tour="set-nav-m" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
        {SECTIONS.map((s) => {
          const on = s.key === active.key
          return (
            <button
              key={s.key}
              type="button"
              data-tour={tourName(s.key, "-m")}
              aria-current={on ? "page" : undefined}
              onClick={() => select(s.key)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition active:scale-[0.97] ${
                on ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <Svg d={s.icon} className="h-4 w-4" />
              {label(s)}
            </button>
          )
        })}
      </nav>

      <div className="lg:flex lg:gap-8">
        <nav aria-label={t("admin.settings", { defaultValue: "Paramètres" })} className="hidden w-64 shrink-0 lg:block">
          <ul data-tour="set-nav" className="sticky top-20 space-y-1 rounded-card border border-line bg-surface p-2 shadow-card">
            {SECTIONS.map((s) => {
              const on = s.key === active.key
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    data-tour={tourName(s.key, "")}
                    aria-current={on ? "page" : undefined}
                    onClick={() => select(s.key)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${
                      on ? "bg-primary-light/60 text-primary-dark" : "text-muted hover:bg-page hover:text-ink"
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-primary text-white" : "bg-line/60"}`}>
                      <Svg d={s.icon} className="h-4 w-4" />
                    </span>
                    {label(s)}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section key={active.key} className="min-w-0 flex-1 animate-fade-up">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
                <Svg d={active.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{label(active)}</h2>
                <p className="mt-0.5 max-w-2xl text-sm text-muted">{fr ? active.desc[0] : active.desc[1]}</p>
              </div>
            </div>
            {active.preview && (
              <div data-tour="set-preview" className="flex flex-wrap gap-2">
                {active.preview.map((p) => (
                  <a key={p.to} href={p.to} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
                    <Svg d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" className="h-4 w-4" />
                    {fr ? p.label[0] : p.label[1]}
                  </a>
                ))}
              </div>
            )}
          </header>
          {active.render()}
        </section>
      </div>
    </div>
  )
}