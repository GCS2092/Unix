import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { usersAdminApi } from "../../api/usersAdmin"
import { countryOptions } from "../../lib/geo"
import { getErrorMessage } from "../../lib/errors"
import { getFieldErrors } from "../../lib/fieldErrors"
import { toast } from "../../stores/toastStore"

const input =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

type Initial = Record<string, string | null | undefined>
const KEYS = ["name", "phone", "gender", "birth_date", "birth_place", "birth_country", "nationality", "country", "city", "address", "profession"] as const

/** Correction par l'admin des informations d'identite d'un etudiant. */
export default function AdminUserProfileModal({ userId, initial, onClose, onSaved }: { userId: number; initial: Initial; onClose: () => void; onSaved: () => void }) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const countries = useMemo(() => countryOptions(fr ? "fr" : "en"), [fr])
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, String(initial[k] ?? "").slice(0, k === "birth_date" ? 10 : 999)])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const save = useMutation({
    mutationFn: () => {
      const p: Record<string, string | null> = {}
      for (const k of KEYS) p[k] = f[k].trim() === "" ? null : f[k].trim()
      if (!p.name) throw new Error(L("Le nom est obligatoire.", "Name is required."))
      return usersAdminApi.updateProfile(userId, p)
    },
    onSuccess: () => { toast.success(L("Informations corrigées.", "Details corrected.")); onSaved(); onClose() },
    onError: (e) => {
      const fe = getFieldErrors(e)
      setErrors(fe)
      if (Object.keys(fe).length === 0) toast.error(getErrorMessage(e))
    },
  })

  const text = (k: string, label: string, type = "text") => (
    <label className="block text-sm font-medium">
      {label}
      <input type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} className={input} />
      {errors[k] && <span className="mt-1 block text-xs text-danger">{errors[k]}</span>}
    </label>
  )
  const country = (k: string, label: string) => (
    <label className="block text-sm font-medium">
      {label}
      <select value={f[k]} onChange={(e) => set(k)(e.target.value)} className={input}>
        <option value="">—</option>
        {countries.top.map((c) => <option key={`t-${c.code}`} value={c.code}>{c.name}</option>)}
        <option disabled>──────────</option>
        {countries.all.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      {errors[k] && <span className="mt-1 block text-xs text-danger">{errors[k]}</span>}
    </label>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErrors({}); save.mutate() }} noValidate
        className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-card-lg sm:rounded-2xl">
        <h2 className="text-lg font-bold">{L("Corriger les informations de l'étudiant", "Correct student details")}</h2>
        {text("name", L("Nom complet", "Full name"))}
        {text("phone", L("Téléphone", "Phone"))}
        <label className="block text-sm font-medium">
          {L("Sexe", "Gender")}
          <select value={f.gender} onChange={(e) => set("gender")(e.target.value)} className={input}>
            <option value="">—</option>
            <option value="male">{L("Homme", "Male")}</option>
            <option value="female">{L("Femme", "Female")}</option>
          </select>
          {errors.gender && <span className="mt-1 block text-xs text-danger">{errors.gender}</span>}
        </label>
        {text("birth_date", L("Date de naissance", "Date of birth"), "date")}
        {text("birth_place", L("Lieu de naissance (ville)", "Place of birth (city)"))}
        {country("birth_country", L("Pays de naissance", "Country of birth"))}
        {country("nationality", L("Nationalité (pays)", "Nationality (country)"))}
        {country("country", L("Pays de résidence", "Country of residence"))}
        {text("city", L("Ville de résidence", "City of residence"))}
        {text("address", L("Adresse", "Address"))}
        {text("profession", L("Profession / études", "Profession / studies"))}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5">{L("Annuler", "Cancel")}</button>
          <button type="submit" disabled={save.isPending} className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95 disabled:opacity-50">
            {save.isPending ? L("Enregistrement…", "Saving…") : L("Enregistrer", "Save")}
          </button>
        </div>
      </form>
    </div>
  )
}