import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { aboutApi, EXTRA_LINKS, type AboutData } from "../../api/about"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import { SaveBar } from "../../components/admin/SettingsUi"
import BannerSettings from "./BannerSettings"
import GallerySettings from "./GallerySettings"

const input = "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

function Form({ initial }: { initial: AboutData }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const qc = useQueryClient()
  const [, setParams] = useSearchParams()
  const [form, setForm] = useState<AboutData>(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = (k: keyof AboutData, v: string) => setForm((s) => ({ ...s, [k]: v }))

  const save = useMutation({
    mutationFn: () => aboutApi.adminUpdate(form),
    onSuccess: async () => {
      toast.success(fr ? "Enregistr\u00e9" : "Saved")
      await qc.invalidateQueries({ queryKey: ["admin-about"] })
      await qc.invalidateQueries({ queryKey: ["about"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <h3 className="font-semibold">{fr ? "Textes de la page" : "Page texts"}</h3>
        <label className="block text-sm">
          <span className="font-medium">{fr ? "Phrase d'accroche (FR)" : "Tagline (FR)"}</span>
          <input className={input} maxLength={160} value={form.tagline_fr} onChange={(e) => set("tagline_fr", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{fr ? "Phrase d'accroche (EN)" : "Tagline (EN)"}</span>
          <input className={input} maxLength={160} value={form.tagline_en} onChange={(e) => set("tagline_en", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{fr ? "Notre histoire (FR)" : "Our story (FR)"}</span>
          <textarea className={input} rows={6} maxLength={3000} value={form.story_fr} onChange={(e) => set("story_fr", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{fr ? "Notre histoire (EN)" : "Our story (EN)"}</span>
          <textarea className={input} rows={6} maxLength={3000} value={form.story_en} onChange={(e) => set("story_en", e.target.value)} />
        </label>
      </div>

      <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div>
          <h3 className="font-semibold">{fr ? "Autres r\u00e9seaux et liens" : "Other networks and links"}</h3>
          <p className="mt-1 text-xs text-muted">
            {fr
              ? "Laissez vide pour masquer. Facebook, Instagram et TikTok se g\u00e8rent dans "
              : "Leave empty to hide. Facebook, Instagram and TikTok are managed in "}
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setParams({ section: "vitrine" })}>
              {fr ? "Vitrine" : "Storefront"}
            </button>.
          </p>
        </div>
        {EXTRA_LINKS.map((l) => (
          <label key={l.key} className="block text-sm">
            <span className="font-medium">{l.label}</span>
            <input className={input} type="url" inputMode="url" placeholder={l.placeholder} value={form[l.key]} onChange={(e) => set(l.key, e.target.value)} />
          </label>
        ))}
      </div>

      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onCancel={() => setForm(initial)} />
    </div>
  )
}

export default function AboutSettingsForm() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-about"],
    queryFn: async () => (await aboutApi.adminGet()).data.data,
    staleTime: 0,
  })
  return (
    <>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (<div className="space-y-6"><BannerSettings /><GallerySettings /><Form key={JSON.stringify(data)} initial={data} /></div>)}
    </>
  )
}