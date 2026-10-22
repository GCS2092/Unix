import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { certificatesAdminApi } from "../../api/certificatesAdmin"
import { countryOptions } from "../../lib/geo"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const input =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

/** Correction des informations imprimees sur un certificat (nom, naissance) puis regeneration du PDF. */
export default function CertificateCorrectModal({ enrollmentId, onClose }: { enrollmentId: number; onClose: () => void }) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const countries = useMemo(() => countryOptions(fr ? "fr" : "en"), [fr])

  const [name, setName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [birthPlace, setBirthPlace] = useState("")
  const [birthCountry, setBirthCountry] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  const info = useQuery({
    queryKey: ["cert-identity", enrollmentId],
    queryFn: async () => (await certificatesAdminApi.identity(enrollmentId)).data.data,
    staleTime: 0,
    gcTime: 0,
  })

  useEffect(() => {
    const d = info.data
    if (!d || loaded) return
    setName(d.name)
    setBirthDate(d.birth_date ?? "")
    setBirthPlace(d.birth_place ?? "")
    setBirthCountry(d.birth_country ?? "")
    setLoaded(true)
  }, [info.data, loaded])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const save = useMutation({
    mutationFn: () =>
      certificatesAdminApi.correct(enrollmentId, {
        name: name.trim(),
        birth_date: birthDate || null,
        birth_place: birthPlace.trim() || null,
        birth_country: birthCountry || null,
      }),
    onSuccess: async (res) => {
      toast.success(res.data.data.regenerated
        ? L("Informations corrigées et PDF régénéré.", "Details corrected and PDF regenerated.")
        : L("Informations corrigées.", "Details corrected."))
      for (const k of ["admin-certificates", "admin-certificates-students", "admin-enrollments", "cert-emailed"]) {
        await qc.invalidateQueries({ queryKey: [k] })
      }
      onClose()
    },
    onError: (e) => {
      const f = getFieldErrors(e)
      setErrors(f)
      if (Object.keys(f).length === 0) toast.error(getErrorMessage(e))
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (name.trim().length < 3) local.name = L("Indiquez le nom complet.", "Enter the full name.")
    setErrors(local)
    if (Object.keys(local).length === 0) save.mutate()
  }

  const d = info.data

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={L("Corriger les informations", "Correct details")}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={submit} noValidate className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-card-lg sm:rounded-2xl">
        <div>
          <h2 className="text-lg font-bold">{L("Corriger les informations", "Correct details")}</h2>
          {d && <p className="mt-0.5 text-sm text-muted">{d.course_title} · {d.email}</p>}
        </div>

        {info.isLoading && <p className="text-sm text-muted">{L("Chargement…", "Loading…")}</p>}
        {info.isError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(info.error)}</p>}

        {d && (
          <>
            <label className="block text-sm font-medium">
              {L("Nom complet (tel qu'il sera imprimé)", "Full name (as printed)")}
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={255} />
              {errors.name && <span className="mt-1 block text-xs text-danger">{errors.name}</span>}
            </label>
            <label className="block text-sm font-medium">
              {L("Date de naissance", "Date of birth")}
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={input} />
              {errors.birth_date && <span className="mt-1 block text-xs text-danger">{errors.birth_date}</span>}
            </label>
            <label className="block text-sm font-medium">
              {L("Lieu de naissance (ville)", "Place of birth (city)")}
              <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={input} maxLength={120} />
              {errors.birth_place && <span className="mt-1 block text-xs text-danger">{errors.birth_place}</span>}
            </label>
            <label className="block text-sm font-medium">
              {L("Pays de naissance", "Country of birth")}
              <select value={birthCountry} onChange={(e) => setBirthCountry(e.target.value)} className={input}>
                <option value="">—</option>
                {countries.top.map((c) => <option key={`t-${c.code}`} value={c.code}>{c.name}</option>)}
                <option disabled>──────────</option>
                {countries.all.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              {errors.birth_country && <span className="mt-1 block text-xs text-danger">{errors.birth_country}</span>}
            </label>

            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted">
              {d.has_certificate
                ? L("Le certificat existant sera régénéré avec ces informations. Son code de vérification et sa date de délivrance ne changent pas. Le marqueur « Envoyé » est remis à zéro : pensez à le renvoyer.",
                    "The existing certificate will be regenerated. Its verification code and issue date stay the same. The “Sent” marker is reset: remember to resend it.")
                : L("Aucun certificat n'est encore émis : ces informations seront utilisées à l'émission.", "No certificate has been issued yet: these details will be used when it is issued.")}
            </p>
            <p className="text-xs text-muted">{L("Ces informations sont aussi modifiées sur le compte de l'élève.", "These details are also updated on the student's account.")}</p>
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5">
            {L("Annuler", "Cancel")}
          </button>
          <button type="submit" disabled={!d || save.isPending} className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50">
            {save.isPending ? L("Enregistrement…", "Saving…") : d?.has_certificate ? L("Corriger et régénérer le PDF", "Correct and regenerate PDF") : L("Enregistrer", "Save")}
          </button>
        </div>
      </form>
    </div>
  )
}