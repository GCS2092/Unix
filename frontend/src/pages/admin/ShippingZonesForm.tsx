import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type ShippingZoneRow } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { formatPrice } from "../../lib/format"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

const input =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const KEY = ["admin-shipping-zones"]

function useRefresh() {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: KEY })
    await qc.invalidateQueries({ queryKey: ["shipping"] })
  }
}

function ZoneRow({ zone }: { zone: ShippingZoneRow }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const refresh = useRefresh()
  const [labelFr, setLabelFr] = useState(zone.label_fr)
  const [labelEn, setLabelEn] = useState(zone.label_en ?? "")
  const [fee, setFee] = useState(String(zone.fee))
  const [active, setActive] = useState(zone.is_active)

  const save = useMutation({
    mutationFn: () => {
      const n = Number(fee)
      if (!Number.isInteger(n) || n < 0) throw new Error(fr ? "Le tarif doit être un entier positif." : "The fee must be a positive integer.")
      return adminApi.updateShippingZone(zone.id, {
        label_fr: labelFr.trim(),
        label_en: labelEn.trim() === "" ? null : labelEn.trim(),
        fee: n,
        is_active: active,
      })
    },
    onSuccess: async () => { toast.success(fr ? "Zone enregistrée" : "Zone saved"); await refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => adminApi.deleteShippingZone(zone.id),
    onSuccess: async () => { toast.success(fr ? "Zone supprimée" : "Zone deleted"); await refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <li className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="font-mono">{zone.code}</span>
        <span>{fr ? `${zone.orders_count} commande(s)` : `${zone.orders_count} order(s)`} · {formatPrice(Number(fee) || 0)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium">{fr ? "Libellé (français)" : "Label (French)"}</span>
          <input className={input} value={labelFr} maxLength={100} onChange={(e) => setLabelFr(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Libellé (anglais)" : "Label (English)"}</span>
          <input className={input} value={labelEn} maxLength={100} onChange={(e) => setLabelEn(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Tarif (FCFA)" : "Fee (FCFA)"}</span>
          <input className={input} type="number" inputMode="numeric" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        <label className="flex min-h-[44px] items-center gap-3 self-end text-sm">
          <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {fr ? "Zone active (proposée au checkout)" : "Active zone (offered at checkout)"}
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate()}>{fr ? "Enregistrer" : "Save"}</Button>
        {zone.orders_count === 0 ? (
          <Button variant="secondary" loading={remove.isPending}
            onClick={() => { if (window.confirm(fr ? "Supprimer cette zone ?" : "Delete this zone?")) remove.mutate() }}>
            {fr ? "Supprimer" : "Delete"}
          </Button>
        ) : (
          <span className="self-center text-xs text-muted">{fr ? "Utilisée par des commandes : désactivez-la plutôt." : "Used by orders: deactivate it instead."}</span>
        )}
      </div>
    </li>
  )
}

function NewZone() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const refresh = useRefresh()
  const [code, setCode] = useState("")
  const [labelFr, setLabelFr] = useState("")
  const [labelEn, setLabelEn] = useState("")
  const [fee, setFee] = useState("0")

  const create = useMutation({
    mutationFn: () =>
      adminApi.createShippingZone({
        code: code.trim().toLowerCase(),
        label_fr: labelFr.trim(),
        label_en: labelEn.trim() === "" ? null : labelEn.trim(),
        fee: Number(fee) || 0,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success(fr ? "Zone ajoutée" : "Zone added")
      setCode(""); setLabelFr(""); setLabelEn(""); setFee("0")
      await refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
      <h4 className="text-sm font-semibold">{fr ? "Ajouter une zone" : "Add a zone"}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium">{fr ? "Code (minuscules, chiffres, _)" : "Code (lowercase, digits, _)"}</span>
          <input className={input} value={code} maxLength={20} placeholder="thies" onChange={(e) => setCode(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Tarif (FCFA)" : "Fee (FCFA)"}</span>
          <input className={input} type="number" inputMode="numeric" min={0} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Libellé (français)" : "Label (French)"}</span>
          <input className={input} value={labelFr} maxLength={100} onChange={(e) => setLabelFr(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Libellé (anglais)" : "Label (English)"}</span>
          <input className={input} value={labelEn} maxLength={100} onChange={(e) => setLabelEn(e.target.value)} /></label>
      </div>
      <p className="text-xs text-muted">{fr ? "Le code ne pourra plus être modifié après la création." : "The code cannot be changed after creation."}</p>
      <Button loading={create.isPending} onClick={() => create.mutate()}>{fr ? "Ajouter" : "Add"}</Button>
    </div>
  )
}

export default function ShippingZonesForm() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await adminApi.shippingZones()).data.data,
    staleTime: 0,
  })

  return (
    <div className="max-w-2xl">
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (
        <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <ul className="space-y-3">{data.map((z) => <ZoneRow key={`${z.id}-${z.fee}-${z.is_active}`} zone={z} />)}</ul>
          <NewZone />
        </div>
      )}
    </div>
  )
}