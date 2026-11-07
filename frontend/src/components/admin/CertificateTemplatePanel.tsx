import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

type Slot = "logo" | "signature" | "signature2" | "stamp"

interface Tpl {
  brand: string
  signer_name: string
  signer_title: string
  signer2_name: string
  signer2_title: string
  color: string
  logo_data: string | null
  logo_is_default: boolean
  signature_data: string | null
  signature2_data: string | null
  stamp_data: string | null
  default_brand: string
}

const DEFAULT_COLOR = "#1f64c0"
const input =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btn =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50"
const MAX = 1024 * 1024
const CHECK = "repeating-conic-gradient(#e8edf3 0% 25%, #ffffff 0% 50%)"

function ImageSlot({ slot, label, hint, data, isDefault = false }: { slot: Slot; label: string; hint: string; data: string | null; isDefault?: boolean }) {
  const qc = useQueryClient()
  const ref = useRef<HTMLInputElement>(null)
  const done = (res: { data: { data: Tpl } }) => qc.setQueryData(["cert-template"], res.data.data)
  const up = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData()
      fd.append("image", f)
      return apiClient.post<{ data: Tpl }>(`/admin/certificate-template/${slot}`, fd)
    },
    onSuccess: done,
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const rm = useMutation({
    mutationFn: () => apiClient.delete<{ data: Tpl }>(`/admin/certificate-template/${slot}`),
    onSuccess: done,
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  function pick(f?: File) {
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type)) { toast.error("Format accepté : PNG ou JPG."); return }
    if (f.size > MAX) { toast.error("Image trop lourde (1 Mo maximum)."); return }
    up.mutate(f)
  }
  const custom = !!data && !isDefault
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className="grid h-24 w-36 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line p-1 text-xs text-muted"
          style={{ backgroundImage: CHECK, backgroundSize: "14px 14px" }}
        >
          {data ? <img src={data} alt="" className="max-h-full max-w-full object-contain" /> : <span className="rounded bg-surface px-1.5 py-0.5">Aucune image</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" className={btn} disabled={up.isPending || rm.isPending} onClick={() => ref.current?.click()}>
            {up.isPending ? "Envoi…" : custom ? "Remplacer" : isDefault ? "Choisir un autre logo" : "Choisir"}
          </button>
          {custom && <button type="button" className={`${btn} text-danger`} disabled={rm.isPending} onClick={() => rm.mutate()}>Retirer</button>}
        </div>
      </div>
      {isDefault && <p className="text-xs font-semibold text-primary">Logo IGA par défaut (aucun logo téléversé)</p>}
      <p className="text-xs text-muted">{hint}</p>
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
    </div>
  )
}

/** Reglages du certificat PDF : organisme, deux signataires, logo, tampon, couleur, apercu. */
export default function CertificateTemplatePanel() {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const [brand, setBrand] = useState("")
  const [signerName, setSignerName] = useState("")
  const [signerTitle, setSignerTitle] = useState("")
  const [signer2Name, setSigner2Name] = useState("")
  const [signer2Title, setSigner2Title] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [loaded, setLoaded] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const q = useQuery({
    queryKey: ["cert-template"],
    queryFn: async () => (await apiClient.get<{ data: Tpl }>("/admin/certificate-template")).data.data,
    staleTime: 0,
  })

  if (q.data && !loaded) {
    const d = q.data
    setLoaded(true)
    setBrand(d.brand)
    setSignerName(d.signer_name)
    setSignerTitle(d.signer_title)
    setSigner2Name(d.signer2_name)
    setSigner2Title(d.signer2_title)
    setColor(d.color)
  }

  const save = useMutation({
    mutationFn: () => apiClient.put<{ data: Tpl }>("/admin/certificate-template", {
      brand: brand.trim() || null,
      signer_name: signerName.trim() || null,
      signer_title: signerTitle.trim() || null,
      signer2_name: signer2Name.trim() || null,
      signer2_title: signer2Title.trim() || null,
      color,
    }),
    onSuccess: (res) => {
      qc.setQueryData(["cert-template"], res.data.data)
      toast.success(L("Modèle enregistré.", "Template saved."))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  async function preview() {
    setPreviewing(true)
    const win = window.open("", "_blank")
    try {
      // L'aperçu utilise les réglages enregistrés : on enregistre d'abord
      await save.mutateAsync()
      const res = await apiClient.get<Blob>("/admin/certificate-template/preview", { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      if (win) win.location.href = url
      else window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      win?.close()
      toast.error(getErrorMessage(e))
    } finally {
      setPreviewing(false)
    }
  }

  const d = q.data

  return (
    <section className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div>
        <h2 className="text-lg font-bold">{L("Modèle du certificat", "Certificate template")}</h2>
        <p className="mt-1 text-sm text-muted">
          {L("S'applique aux nouveaux certificats et à ceux que vous régénérez (Corriger les infos, Réémettre). Les PDF déjà délivrés ne changent pas.",
             "Applies to new certificates and those you regenerate. Already issued PDFs do not change.")}
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted">{L("Chargement…", "Loading…")}</p>}
      {q.isError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(q.error)}</p>}

      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">
              {L("Nom de l'organisme", "Organisation name")}
              <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} placeholder={d.default_brand} className={input} />
              <span className="mt-1 block text-xs font-normal text-muted">{L("Vide : « ", "Empty: \"")}{d.default_brand}{L(" » est utilisé.", "\" is used.")}</span>
            </label>
            <label className="block text-sm font-medium">
              {L("Couleur principale", "Main colour")}
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
                <code className="text-sm text-muted">{color}</code>
                <button type="button" className={btn} onClick={() => setColor(DEFAULT_COLOR)}>{L("Par défaut", "Default")}</button>
              </div>
            </label>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="space-y-3 rounded-xl border border-line p-4">
              <legend className="px-2 text-sm font-bold">{L("Signataire 1", "Signer 1")}</legend>
              <label className="block text-sm font-medium">
                {L("Nom", "Name")}
                <input value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={120} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {L("Fonction", "Title")}
                <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} maxLength={120} placeholder={L("Directeur des formations", "Head of training")} className={input} />
              </label>
              <ImageSlot slot="signature" label={L("Image de signature", "Signature image")} hint={L("PNG sur fond transparent de préférence.", "Transparent PNG preferred.")} data={d.signature_data} />
            </fieldset>

            <fieldset className="space-y-3 rounded-xl border border-line p-4">
              <legend className="px-2 text-sm font-bold">{L("Signataire 2 (facultatif)", "Signer 2 (optional)")}</legend>
              <label className="block text-sm font-medium">
                {L("Nom", "Name")}
                <input value={signer2Name} onChange={(e) => setSigner2Name(e.target.value)} maxLength={120} className={input} />
              </label>
              <label className="block text-sm font-medium">
                {L("Fonction", "Title")}
                <input value={signer2Title} onChange={(e) => setSigner2Title(e.target.value)} maxLength={120} placeholder={L("Responsable pédagogique", "Academic lead")} className={input} />
              </label>
              <ImageSlot slot="signature2" label={L("Image de signature", "Signature image")} hint={L("PNG sur fond transparent de préférence.", "Transparent PNG preferred.")} data={d.signature2_data} />
            </fieldset>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ImageSlot slot="logo" label="Logo" hint={L("PNG ou JPG, 1 Mo maximum. Affiché en haut du certificat.", "PNG or JPG, 1 MB max. Shown at the top.")} data={d.logo_data} isDefault={d.logo_is_default} />
            <ImageSlot slot="stamp" label={L("Tampon", "Stamp")} hint={L("PNG sur fond transparent, carré ou rond. Placé au centre, entre les signatures. Sans tampon : sceau « Certifié authentique ».", "Transparent PNG, square or round. Centred between the signatures. Without a stamp: a “Certified authentic” seal is shown.")} data={d.stamp_data} />
          </div>

          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted">
            {L("Un seul signataire : la date de délivrance apparaît à gauche, la signature à droite. Deux signataires : signature, tampon, signature, et la date passe dans le pied de page.",
               "One signer: the issue date appears on the left, the signature on the right. Two signers: signature, stamp, signature, and the date moves to the footer.")}
          </p>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" disabled={save.isPending || previewing} onClick={() => save.mutate()} className={btnPrimary}>
              {save.isPending && !previewing ? L("Enregistrement…", "Saving…") : L("Enregistrer", "Save")}
            </button>
            <button type="button" disabled={save.isPending || previewing} onClick={() => void preview()} className={btn}>
              {previewing ? L("Génération…", "Generating…") : L("Enregistrer et voir l'aperçu PDF", "Save and preview PDF")}
            </button>
          </div>
        </>
      )}
    </section>
  )
}