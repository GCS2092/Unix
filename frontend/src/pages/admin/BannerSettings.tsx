import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { aboutApi, aboutBannerApi, type BannerSlot } from "../../api/about"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"

const MAX = 2 * 1024 * 1024

function Slot({ slot, title, hint, url }: { slot: BannerSlot; title: string; hint: string; url: string }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-banners"] })
    await qc.invalidateQueries({ queryKey: ["about"] })
  }
  const up = useMutation({
    mutationFn: (file: File) => aboutBannerApi.upload(slot, file),
    onSuccess: async () => { toast.success(fr ? "Banni\u00e8re enregistr\u00e9e" : "Banner saved"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const del = useMutation({
    mutationFn: () => aboutBannerApi.remove(slot),
    onSuccess: async () => { toast.success(fr ? "Banni\u00e8re supprim\u00e9e" : "Banner removed"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function pick(file?: File) {
    if (!file) return
    if (file.size > MAX) {
      toast.error(fr ? "Image trop lourde (2 Mo maximum)." : "Image too large (2 MB max).")
      return
    }
    up.mutate(file)
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-page">
        {url ? (
          <img src={url} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center text-xs text-muted">{fr ? "Aucune image" : "No image"}</div>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={up.isPending} onClick={() => input.current?.click()}>
          {url ? (fr ? "Remplacer" : "Replace") : (fr ? "Choisir une image" : "Choose image")}
        </Button>
        {url && (
          <Button size="sm" variant="secondary" loading={del.isPending} onClick={() => del.mutate()}>
            {fr ? "Supprimer" : "Remove"}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function BannerSettings() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await aboutApi.adminGet()).data.data,
    staleTime: 0,
  })
  const hint = fr ? "JPG, PNG ou WebP, 2 Mo max. Id\u00e9al : 1600\u00d7600 px." : "JPG, PNG or WebP, 2 MB max. Ideal: 1600\u00d7600 px."

  return (
    <div className="max-w-2xl space-y-5 rounded-card border border-line bg-surface p-5 shadow-card">
      <div>
        <h3 className="font-semibold">{fr ? "Banni\u00e8res" : "Banners"}</h3>
        <p className="mt-1 text-xs text-muted">
          {fr ? "L'image appara\u00eet en fond du grand bloc, avec un voile pour garder le texte lisible. Sans image, le design par d\u00e9faut reste affich\u00e9." : "The image appears behind the hero block, with an overlay to keep the text readable. Without an image, the default design stays."}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Slot slot="home" title={fr ? "Banni\u00e8re de l'accueil" : "Home banner"} hint={hint} url={data?.banner_home_url ?? ""} />
        <Slot slot="about" title={fr ? "Banni\u00e8re de la page \u00c0 propos" : "About page banner"} hint={hint} url={data?.banner_about_url ?? ""} />
      </div>
    </div>
  )
}