import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type CommunicationSettings, type ShopSettingsData } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

const inputClass =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

function Form({ comms, shop }: { comms: CommunicationSettings; shop: ShopSettingsData }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [name, setName] = useState(comms.shop_name)
  const [syncLegal, setSyncLegal] = useState(true)
  const [syncMail, setSyncMail] = useState(true)

  const save = useMutation({
    mutationFn: async () => {
      const n = name.trim()
      if (n === "") throw new Error(L("Le nom de la boutique est obligatoire.", "The shop name is required."))
      await adminApi.updateCommunicationSettings({ ...comms, shop_name: n })
      if (syncLegal || syncMail) {
        await adminApi.updateShopSettings({
          ...shop,
          legal_name: syncLegal ? n : shop.legal_name,
          mail_from_name: syncMail ? n : shop.mail_from_name,
        })
      }
    },
    onSuccess: async () => {
      toast.success(L("Nom enregistré", "Name saved"))
      for (const key of ["admin-comms", "admin-shop-settings", "public-shop", "public-comms", "shipping"]) {
        await qc.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const check = "flex min-h-[44px] items-start gap-3 text-sm"
  const box = "mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary,#2563eb)]"

  return (
    <div className="max-w-2xl space-y-4">
      <section className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <h3 className="font-semibold">{L("Nom de la boutique", "Shop name")}</h3>
        <label className="block text-sm">
          <span className="font-medium">{L("Nom affiché", "Display name")}</span>
          <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">
            {L(
              "Affiché dans le menu, le pied de page, l'accueil, l'onglet du navigateur, la connexion et les e-mails.",
              "Shown in the menu, footer, home page, browser tab, login pages and emails.",
            )}
          </span>
        </label>

        <label className={check}>
          <input type="checkbox" className={box} checked={syncLegal} onChange={(e) => setSyncLegal(e.target.checked)} />
          <span>
            {L("Mettre aussi à jour le nom légal des factures", "Also update the legal name on invoices")}
            <span className="block text-xs text-muted">
              {L(`Actuellement : « ${shop.legal_name || "vide"} ». Les factures déjà émises ne changent pas.`, `Currently: "${shop.legal_name || "empty"}". Issued invoices do not change.`)}
            </span>
          </span>
        </label>

        <label className={check}>
          <input type="checkbox" className={box} checked={syncMail} onChange={(e) => setSyncMail(e.target.checked)} />
          <span>
            {L("Mettre aussi à jour le nom d'expéditeur des e-mails", "Also update the email sender name")}
            <span className="block text-xs text-muted">
              {L(`Actuellement : « ${shop.mail_from_name || "vide"} ».`, `Currently: "${shop.mail_from_name || "empty"}".`)}
            </span>
          </span>
        </label>

        <Button loading={save.isPending} onClick={() => save.mutate()}>{L("Enregistrer", "Save")}</Button>
      </section>
    </div>
  )
}

export default function BrandSettingsForm() {
  const comms = useQuery({
    queryKey: ["admin-comms"],
    queryFn: async () => (await adminApi.communicationSettings()).data.data,
    staleTime: 0,
  })
  const shop = useQuery({
    queryKey: ["admin-shop-settings"],
    queryFn: async () => (await adminApi.shopSettings()).data.data,
    staleTime: 0,
  })

  const error = comms.error ?? shop.error
  return (
    <div>
      {(comms.isLoading || shop.isLoading) && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => { void comms.refetch(); void shop.refetch() }} />}
      {comms.data && shop.data && <Form key={JSON.stringify([comms.data.shop_name, shop.data.legal_name, shop.data.mail_from_name])} comms={comms.data} shop={shop.data} />}
    </div>
  )
}