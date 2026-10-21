import { useMemo, useRef, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min"
import { coursesApi } from "../api/courses"
import { enrollmentRequestsApi } from "../api/enrollmentRequests"
import { formationSignupApi } from "../api/formationSignup"
import { TOKEN_KEY } from "../api/client"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import { isEmail, msg } from "../lib/validate"
import {
  MAX_AGE, MIN_AGE, NAME_RE, PLACE_RE,
  ageFrom, citiesFor, countryOptions, phoneOptions, suggestEmail,
  type CountryOption,
} from "../lib/geo"
import Button from "../components/Button"
import FormField from "../components/FormField"
import PageLoader from "../components/PageLoader"
import WhatsAppFab from "../components/WhatsAppFab"
import PublicHeader from "../components/PublicHeader"
import { usePageTitle } from "../hooks/usePageTitle"
import Footer from "../components/Footer"
import PublicBottomNav from "../components/PublicBottomNav"

const base =
  "min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const selectClass = `mt-1 w-full ${base}`

type ProfileKey = "gender" | "birth_date" | "birth_place" | "birth_country" | "nationality" | "country" | "city" | "address" | "profession"

function CountrySelect(props: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
  countries: { top: CountryOption[]; all: CountryOption[] }
}) {
  const { label, placeholder, value, onChange, error, countries } = props
  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          <option value="">{placeholder}</option>
          {countries.top.map((c) => <option key={`t-${c.code}`} value={c.code}>{c.name}</option>)}
          <option disabled>──────────</option>
          {countries.all.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function CityInput(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  cities: string[]
}) {
  const { id, label, value, onChange, error, cities } = props
  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        <input list={`${id}-list`} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" className={selectClass} />
      </label>
      <datalist id={`${id}-list`}>{cities.map((c) => <option key={c} value={c} />)}</datalist>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export default function FormationSignupPage() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "fr").slice(0, 2)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const login = useAuthStore((s) => s.login)
  const lock = useRef(false)
  usePageTitle(t("px.signup.page_title", { defaultValue: "Inscription à une formation" }))

  const countries = useMemo(() => countryOptions(lang), [lang])
  const phoneOpts = useMemo(() => phoneOptions(lang), [lang])
  const phoneCodes = useMemo(() => new Set<string>(phoneOpts.map((o) => o.code)), [phoneOpts])

  const [mode, setMode] = useState<"signup" | "login">("signup")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("SN")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [courseId, setCourseId] = useState("")
  const [message, setMessage] = useState("")
  const [profile, setProfile] = useState<Record<ProfileKey, string>>({
    gender: "", birth_date: "", birth_place: "", birth_country: "", nationality: "", country: "", city: "", address: "", profession: "",
  })
  const setP = (k: ProfileKey) => (v: string) => setProfile((s) => ({ ...s, [k]: v }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<{ slug: string | null; title: string | null; created: boolean } | null>(null)

  const catalog = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => (await coursesApi.catalog()).data.data,
  })

  const slugParam = params.get("cours")
  const preselect = catalog.data?.find((c) => c.slug === slugParam)
  const effective = courseId || (preselect ? String(preselect.id) : "")
  const chosen = catalog.data?.find((c) => String(c.id) === effective)

  /** Pre-remplissage : pays de naissance -> nationalite -> pays de residence. */
  function pickCountry(k: "birth_country" | "nationality" | "country", v: string) {
    setProfile((s) => {
      const n = { ...s, [k]: v }
      if (v && k === "birth_country") {
        if (!s.nationality) n.nationality = v
        if (!s.country) n.country = v
      }
      if (v && k === "nationality" && !s.country) n.country = v
      return n
    })
    if (k === "country" && v && !phone.trim() && phoneCodes.has(v)) setPhoneCountry(v as CountryCode)
  }

  if (authLoading) return <PageLoader />
  if (user && !lock.current && !done) {
    if (user.is_admin) return <Navigate to="/admin" replace />
    return <Navigate to={slugParam ? `/formations/${slugParam}` : "/etudiant/catalogue"} replace />
  }

  const liveMismatch = mode === "signup" && confirmation.length > 0 && confirmation !== password
  const emailFix = suggestEmail(email)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const req = t("px.signup.required", { defaultValue: "Ce champ est obligatoire." })
    const invalid = t("px.signup.invalid", { defaultValue: "Valeur invalide." })
    const local: Record<string, string> = {}
    const cleanName = name.trim().replace(/\s+/g, " ")
    const parsedPhone = mode === "signup" ? parsePhoneNumberFromString(phone.trim(), phoneCountry) : undefined

    if (mode === "signup") {
      if (cleanName.length < 3 || cleanName.split(" ").length < 2 || !NAME_RE.test(cleanName)) {
        local.name = t("px.signup.name_error", { defaultValue: "Indiquez votre prénom et votre nom (lettres uniquement)." })
      }
      if (!parsedPhone || !parsedPhone.isValid()) {
        local.phone = t("px.signup.phone_error", { defaultValue: "Numéro invalide pour ce pays. Vérifiez l'indicatif et le numéro." })
      }
      if (!profile.gender) local.gender = req

      const age = ageFrom(profile.birth_date)
      if (!profile.birth_date) local.birth_date = req
      else if (age === null) local.birth_date = t("px.signup.date_error", { defaultValue: "Date invalide." })
      else if (age < MIN_AGE) local.birth_date = t("px.signup.age_min", { defaultValue: "Vous devez avoir au moins {{age}} ans.", age: MIN_AGE })
      else if (age > MAX_AGE) local.birth_date = t("px.signup.date_error", { defaultValue: "Date invalide." })

      for (const k of ["birth_country", "nationality", "country"] as const) {
        if (!profile[k]) local[k] = req
      }
      for (const k of ["birth_place", "city"] as const) {
        const v = profile[k].trim()
        if (!v) local[k] = req
        else if (v.length < 2 || !PLACE_RE.test(v)) local[k] = invalid
      }
      const addr = profile.address.trim()
      if (addr && addr.length < 5) local.address = t("px.signup.address_error", { defaultValue: "Adresse trop courte." })
    }

    if (!isEmail(email.trim())) local.email = msg.email()
    if (password.length < 8) local.password = msg.password()
    else if (mode === "signup" && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      local.password = t("px.signup.password_strength", { defaultValue: "Le mot de passe doit contenir au moins une lettre et un chiffre." })
    }
    if (mode === "signup" && password !== confirmation) {
      local.password_confirmation = t("auth.password_mismatch")
    }
    if (!effective) local.course_id = t("px.signup.course_error", { defaultValue: "Choisissez une formation." })
    if (Object.keys(local).length > 0) {
      setFieldErrors(local)
      return
    }

    lock.current = true
    setLoading(true)
    try {
      if (mode === "signup") {
        const { data } = await formationSignupApi.signup({
          name: cleanName,
          email: email.trim().toLowerCase(),
          phone: parsedPhone?.number ?? "",
          password,
          password_confirmation: confirmation,
          course_id: Number(effective),
          message: message.trim() || undefined,
          ...profile,
        })
        localStorage.setItem(TOKEN_KEY, data.token)
        useAuthStore.setState({ user: data.user, initError: null })
        setDone({ slug: chosen?.slug ?? null, title: chosen?.title ?? null, created: true })
      } else {
        await login(email.trim(), password)
        try {
          await enrollmentRequestsApi.create(Number(effective), message.trim() || undefined)
          setDone({ slug: chosen?.slug ?? null, title: chosen?.title ?? null, created: false })
        } catch (err) {
          toast.error(getErrorMessage(err))
          navigate(chosen ? `/formations/${chosen.slug}` : "/etudiant/catalogue", { replace: true })
        }
      }
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
    } finally {
      lock.current = false
      setLoading(false)
    }
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-page">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        {content}
      </main>
      <div className="bg-surface pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"><Footer /></div>
      <PublicBottomNav />
      <WhatsAppFab />
    </div>
  )

  if (done) {
    return shell(
      <div className="space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card" role="status">
        <h1 className="text-2xl font-bold">{t("px.signup.done_title", { defaultValue: "Demande envoyée" })}</h1>
        <p className="text-sm text-muted">
          {done.title
            ? t("px.signup.done_course", { defaultValue: "Votre demande pour « {{title}} » a bien été reçue.", title: done.title })
            : t("px.signup.done_generic", { defaultValue: "Votre demande a bien été reçue." })}{" "}
          {t("px.signup.done_next", { defaultValue: "Vous serez prévenu par e-mail dès qu'elle aura été traitée." })}
        </p>
        {done.created && (
          <p className="text-sm text-muted">
            {t("px.signup.done_verify", { defaultValue: "Un e-mail de vérification vous a été envoyé : cliquez sur le lien qu'il contient pour confirmer votre adresse." })}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {done.slug && (
            <Link to={`/formations/${done.slug}`} className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
              {t("px.signup.see_course", { defaultValue: "Voir la formation" })}
            </Link>
          )}
          <Link to="/etudiant/catalogue" className="min-h-[44px] rounded-lg border border-line px-4 py-2.5 text-sm font-semibold">
            {t("px.signup.catalog", { defaultValue: "Catalogue des cours" })}
          </Link>
        </div>
      </div>,
    )
  }

  const choose = t("px.signup.choose_country", { defaultValue: "Choisir un pays" })

  return shell(
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {mode === "signup"
            ? t("px.signup.title", { defaultValue: "Inscription à une formation" })
            : t("px.signup.title_login", { defaultValue: "Connexion et demande d'accès" })}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {mode === "signup"
            ? t("px.signup.subtitle", { defaultValue: "Remplissez ce formulaire : votre compte est créé et votre demande d'accès est transmise à l'équipe." })
            : t("px.signup.subtitle_login", { defaultValue: "Connectez-vous avec votre compte existant pour demander l'accès à une formation." })}
        </p>
      </div>

      <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div>
          <label className="block text-sm font-medium">
            {t("px.signup.course", { defaultValue: "Formation souhaitée" })}
            <select value={effective} onChange={(e) => setCourseId(e.target.value)} className={selectClass}>
              <option value="">{t("px.signup.choose", { defaultValue: "Choisir une formation" })}</option>
              {catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          {fieldErrors.course_id && <p className="mt-1 text-xs text-danger">{fieldErrors.course_id}</p>}
        </div>

        {mode === "signup" && (
          <>
            <FormField label={t("px.signup.fullname", { defaultValue: "Prénom et nom" })} required autoComplete="name" value={name} onChange={setName} error={fieldErrors.name} />

            <div>
              <label className="block text-sm font-medium" htmlFor="px-phone">
                {t("px.signup.phone", { defaultValue: "Téléphone (WhatsApp de préférence)" })}
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  aria-label={t("px.signup.phone_country", { defaultValue: "Indicatif du pays" })}
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value as CountryCode)}
                  className={`${base} w-44 shrink-0`}
                >
                  {phoneOpts.map((o) => <option key={o.code} value={o.code}>{o.name} (+{o.dial})</option>)}
                </select>
                <input
                  id="px-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="77 123 45 67"
                  value={phone} onChange={(e) => setPhone(e.target.value)} className={`${base} min-w-0 flex-1`}
                />
              </div>
              {fieldErrors.phone && <p className="mt-1 text-xs text-danger">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium">
                {t("px.signup.gender", { defaultValue: "Sexe" })}
                <select value={profile.gender} onChange={(e) => setP("gender")(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  <option value="male">{t("px.signup.male", { defaultValue: "Homme" })}</option>
                  <option value="female">{t("px.signup.female", { defaultValue: "Femme" })}</option>
                </select>
              </label>
              {fieldErrors.gender && <p className="mt-1 text-xs text-danger">{fieldErrors.gender}</p>}
            </div>

            <FormField label={t("px.signup.birth_date", { defaultValue: "Date de naissance" })} type="date" required value={profile.birth_date} onChange={setP("birth_date")} error={fieldErrors.birth_date} />

            <CountrySelect
              label={t("px.signup.birth_country", { defaultValue: "Pays de naissance" })} placeholder={choose} countries={countries}
              value={profile.birth_country} onChange={(v) => pickCountry("birth_country", v)} error={fieldErrors.birth_country}
            />
            <CityInput
              id="px-birth-place" label={t("px.signup.birth_place", { defaultValue: "Lieu de naissance (ville)" })}
              value={profile.birth_place} onChange={setP("birth_place")} error={fieldErrors.birth_place} cities={citiesFor(profile.birth_country)}
            />
            <CountrySelect
              label={t("px.signup.nationality", { defaultValue: "Nationalité (pays du passeport)" })} placeholder={choose} countries={countries}
              value={profile.nationality} onChange={(v) => pickCountry("nationality", v)} error={fieldErrors.nationality}
            />
            <CountrySelect
              label={t("px.signup.country", { defaultValue: "Pays de résidence" })} placeholder={choose} countries={countries}
              value={profile.country} onChange={(v) => pickCountry("country", v)} error={fieldErrors.country}
            />
            <CityInput
              id="px-city" label={t("px.signup.city", { defaultValue: "Ville de résidence" })}
              value={profile.city} onChange={setP("city")} error={fieldErrors.city} cities={citiesFor(profile.country)}
            />
            <FormField label={t("px.signup.address", { defaultValue: "Adresse (facultatif)" })} autoComplete="street-address" value={profile.address} onChange={setP("address")} error={fieldErrors.address} />
            <FormField label={t("px.signup.profession", { defaultValue: "Profession ou niveau d'études (facultatif)" })} value={profile.profession} onChange={setP("profession")} error={fieldErrors.profession} />
          </>
        )}

        <FormField
          label={t("auth.email")} type="email" required autoComplete="email" inputMode="email"
          hint={emailFix ? t("px.signup.email_fix", { defaultValue: "Vouliez-vous écrire {{email}} ?", email: emailFix }) : undefined}
          value={email} onChange={setEmail} error={fieldErrors.email}
        />
        <FormField
          label={t("auth.password")} type="password" required minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          hint={mode === "signup" ? t("auth.password_hint") : undefined}
          value={password} onChange={setPassword} error={fieldErrors.password}
        />
        {mode === "signup" && (
          <FormField
            label={t("auth.confirm_password")} type="password" required minLength={8} autoComplete="new-password"
            value={confirmation} onChange={setConfirmation}
            error={fieldErrors.password_confirmation ?? (liveMismatch ? t("auth.password_mismatch") : undefined)}
          />
        )}

        <label className="block text-sm font-medium">
          {t("px.signup.message", { defaultValue: "Message pour l'équipe (facultatif)" })}
          <textarea
            rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={t("px.signup.message_ph", { defaultValue: "Votre niveau, vos objectifs, une question..." })}
            className={selectClass}
          />
        </label>

        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" size="lg" full loading={loading} disabled={liveMismatch}>
          {mode === "signup"
            ? t("px.signup.submit", { defaultValue: "Créer mon compte et demander l'accès" })
            : t("px.signup.submit_login", { defaultValue: "Me connecter et demander l'accès" })}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {mode === "signup" ? t("auth.already") : t("auth.no_account")}{" "}
        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); setFieldErrors({}) }}
          className="font-semibold text-primary hover:underline"
        >
          {mode === "signup"
            ? t("px.signup.have_account", { defaultValue: "J'ai déjà un compte" })
            : t("px.signup.create", { defaultValue: "Créer un compte" })}
        </button>
      </p>
    </div>,
  )
}