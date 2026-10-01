import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminSettings } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

type Key = keyof AdminSettings

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Record<Key, string>>({
    pickup_fee: String(initial.pickup_fee),
    dakar_fee: String(initial.dakar_fee),
    regions_fee: String(initial.regions_fee),
    low_stock_threshold: String(initial.low_stock_threshold),
  })

  const fields: { key: Key; label: string; hint?: string }[] = [
    { key: "pickup_fee", label: t("admin.set_pickup_fee", { defaultValue: "Frais de retrait sur place (FCFA)" }) },
    { key: "dakar_fee", label: t("admin.set_dakar_fee", { defaultValue: "Livraison Dakar et banlieue (FCFA)" }) },
    { key: "regions_fee", label: t("admin.set_regions_fee", { defaultValue: "Livraison autres régions (FCFA)" }) },
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
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
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

export default function AdminSettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await adminApi.settings()).data.data,
    staleTime: 0,
  })

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("admin.settings", { defaultValue: "Paramètres" })}</h2>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && <SettingsForm key={JSON.stringify(data)} initial={data} />}
    </div>
  )
}