import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { aboutApi, aboutBannerApi, aboutVisibilityApi, type BannerSlot } from "../../api/about"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import { Pill, Svg, Switch } from "../../components/admin/ui"
import { ImageDrop } from "../../components/admin/SettingsUi"

const MAX = 2 * 1024 * 1024
const I_UPLOAD = "M12 16V4M7 9l5-5 5 5M4 20h16"

function Slot({ slot, title, url, hidden }: { slot: BannerSlot; title: string; url: string; hidden: boolean }) {
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
    onSuccess: async () => { toast.success(fr ? "Bannière enregistrée" : "Banner saved"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const del = useMutation({
    mutationFn: () => aboutBannerApi.remove(slot),
    onSuccess: async () => { toast.success(fr ? "Bannière supprimée" : "Banner removed"); await done() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const vis = useMutation({
    mutationFn: (h: boolean) => aboutVisibilityApi.banner(slot, h),
    onSuccess: async (_r, h) => {
      toast.success(h ? (fr ? "Bannière masquée du site." : "Banner hidden from the site.") : (fr ? "Bannière visible sur le site." : "Banner visible on the site."))
      await done()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function pick(file?: File) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error(fr ? "Format non accepté (JPG, PNG ou WebP)." : "Unsupported format (JPG, PNG or WebP).")
      return
    }
    if (file.size > MAX) {
      toast.error(fr ? "Image trop lourde (2 Mo maximum)." : "Image too large (2 MB max).")
      return
    }
    up.mutate(file)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {url && <Pill tone={hidden ? "neutral" : "success"} dot>{hidden ? (fr ? "Masquée" : "Hidden") : (fr ? "Visible" : "Visible")}</Pill>}
      </div>

      <ImageDrop onFile={pick} disabled={up.isPending}>
        <div className="group relative aspect-[16/7] overflow-hidden rounded-card border border-line bg-page">
          {url ? (
            <>
              <img src={url} alt="" className={`h-full w-full object-cover transition ${hidden ? "opacity-40 grayscale" : ""}`} />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-ink/70 to-transparent p-2.5 pt-10 transition md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                <Button size="sm" loading={up.isPending} onClick={() => input.current?.click()}>{fr ? "Remplacer" : "Replace"}</Button>
                <Button size="sm" variant="secondary" loading={del.isPending} onClick={() => del.mutate()}>{fr ? "Supprimer" : "Remove"}</Button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => input.current?.click()} disabled={up.isPending}
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-sm text-muted transition hover:text-primary disabled:opacity-60">
              <Svg d={I_UPLOAD} className="h-6 w-6" />
              <span className="font-medium">{up.isPending ? "…" : (fr ? "Glissez une image ici ou cliquez" : "Drop an image here or click")}</span>
              <span className="text-xs">{fr ? "JPG, PNG ou WebP · 2 Mo max · idéal 1600×600 px" : "JPG, PNG or WebP · 2 MB max · ideal 1600×600 px"}</span>
            </button>
          )}
        </div>
      </ImageDrop>

      {url && (
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
          <Switch checked={!hidden} disabled={vis.isPending} onChange={(v) => vis.mutate(!v)} label={fr ? "Afficher la bannière" : "Show the banner"} />
          <span className={hidden ? "text-muted" : "text-emerald-700"}>{hidden ? (fr ? "Masquée sur le site" : "Hidden on the site") : (fr ? "Affichée sur le site" : "Shown on the site")}</span>
        </label>
      )}

      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
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

  return (
    <section className="max-w-2xl space-y-5 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div>
        <h3 className="font-semibold">{fr ? "Bannières" : "Banners"}</h3>
        <p className="mt-1 text-xs text-muted">
          {fr
            ? "L'image apparaît en fond du grand bloc, avec un léger voile pour garder le texte lisible. Masquée ou absente, le design par défaut s'affiche."
            : "The image appears behind the hero block with a light overlay to keep text readable. Hidden or missing, the default design is shown."}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Slot slot="home" title={fr ? "Bannière de l'accueil" : "Home banner"} url={data?.banner_home_url ?? ""} hidden={data?.banner_home_hidden ?? false} />
        <Slot slot="about" title={fr ? "Bannière de la page À propos" : "About page banner"} url={data?.banner_about_url ?? ""} hidden={data?.banner_about_hidden ?? false} />
      </div>
    </section>
  )
}