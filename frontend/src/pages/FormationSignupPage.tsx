import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
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
} from "../lib/geo"
import Button from "../components/Button"
import FormField from "../components/FormField"
import PageLoader from "../components/PageLoader"
import WhatsAppFab from "../components/WhatsAppFab"
import PublicHeader from "../components/PublicHeader"
import { usePageTitle } from "../hooks/usePageTitle"
import Footer from "../components/Footer"
import PublicBottomNav from "../components/PublicBottomNav"
import { CountrySelect, CityInput } from "../components/PlaceFields"
import PhoneIntl from "../components/PhoneIntl"
import EmailCodeBox from "../components/EmailCodeBox"

const base =
  "min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const selectClass = `mt-1 w-full ${base}`

type ProfileKey = "gender" | "birth_date" | "birth_place" | "birth_country" | "nationality" | "country" | "city" | "address" | "profession"

/** Champs de chaque etape (sert a la validation et au saut vers l'etape en erreur). */
const STEP_FIELDS: string[][] = [
  ["course_id", "name"],
  ["gender", "birth_date", "birth_country", "birth_place", "nationality"],
  ["phone", "country", "city", "address", "profession"],
  ["email", "password", "password_confirmation", "message"],
]
const LAST = STEP_FIELDS.length - 1

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  const pct = (step / (labels.length - 1)) * 100
  return (
    <nav aria-label="Progression" className="mb-1">
      <div className="relative mx-4">
        <div className="absolute left-0 right-0 top-4 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute left-0 top-4 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        <ol className="relative flex justify-between">
          {labels.map((l, i) => {
            const done = i < step
            const current = i === step
            return (
              <li key={l} className="flex w-0 flex-col items-center" aria-current={current ? "step" : undefined}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    done
                      ? "border-primary bg-primary text-white"
                      : current
                        ? "border-primary bg-surface text-primary ring-4 ring-primary/15"
                        : "border-line bg-surface text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={`mt-1.5 hidden whitespace-nowrap text-xs font-semibold sm:block ${current ? "text-primary" : "text-muted"}`}>{l}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-primary sm:hidden">
        {step + 1} / {labels.length} · {labels[step]}
      </p>
    </nav>
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
  const [step, setStep] = useState(0)
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
  const setP = (k: ProfileKey) => (v: string) => { setProfile((s) => ({ ...s, [k]: v })); clearErr(k) }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [attempt, setAttempt] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const clearErr = (...keys: string[]) =>
    setFieldErrors((s) => {
      if (!keys.some((k) => s[k])) return s
      const n = { ...s }
      for (const k of keys) delete n[k]
      return n
    })
  useEffect(() => {
    if (attempt === 0) return
    const first = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], p.text-danger")
    const el = first?.matches("input, select, textarea")
      ? first
      : first?.parentElement?.querySelector<HTMLElement>("input, select, textarea")
    ;(el ?? first)?.scrollIntoView({ block: "center", behavior: "smooth" })
    el?.focus({ preventScroll: true })
  }, [attempt])
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
    clearErr("birth_country", "nationality", "country")
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
  const stepLabels = [
    t("px.signup.step_course", { defaultValue: "Formation" }),
    t("px.signup.step_identity", { defaultValue: "Identité" }),
    t("px.signup.step_contact", { defaultValue: "Contact" }),
    t("px.signup.step_account", { defaultValue: "Compte" }),
  ]

  function parsePhone() {
    return mode === "signup" ? parsePhoneNumberFromString(phone.trim(), phoneCountry) : undefined
  }

  /** Calcule toutes les erreurs locales selon le mode. */
  function computeErrors(): Record<string, string> {
    const req = t("px.signup.required", { defaultValue: "Ce champ est obligatoire." })
    const invalid = t("px.signup.invalid", { defaultValue: "Valeur invalide." })
    const local: Record<string, string> = {}
    const cleanName = name.trim().replace(/\s+/g, " ")
    const parsedPhone = parsePhone()

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
    return local
  }

  function stepOf(errs: Record<string, string>): number {
    const idx = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]))
    return idx === -1 ? LAST : idx
  }

  function goTo(n: number) {
    setError(null)
    setFieldErrors({})
    setStep(n)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function next() {
    const all = computeErrors()
    const errs: Record<string, string> = {}
    for (const f of STEP_FIELDS[step]) if (all[f]) errs[f] = all[f]
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setAttempt((n) => n + 1)
      return
    }
    goTo(step + 1)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mode === "signup" && step < LAST) {
      next()
      return
    }
    setError(null)
    setFieldErrors({})

    const local = computeErrors()
    if (Object.keys(local).length > 0) {
      setFieldErrors(local)
      setAttempt((n) => n + 1)
      if (mode === "signup") setStep(stepOf(local))
      return
    }

    const cleanName = name.trim().replace(/\s+/g, " ")
    const parsedPhone = parsePhone()

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
      setAttempt((n) => n + 1)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      else if (mode === "signup") { const known = STEP_FIELDS.flat(); if (!Object.keys(fields).some((k) => known.includes(k))) setError(Object.values(fields)[0] ?? getErrorMessage(err)); setStep(stepOf(fields)) }
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
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success">✓</span>
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
        {done.created && <EmailCodeBox justSent />}
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

  const courseField = (
    <div>
      <label className="block text-sm font-medium">
        {t("px.signup.course", { defaultValue: "Formation souhaitée" })}
        <select value={effective} onChange={(e) => { setCourseId(e.target.value); clearErr("course_id") }} className={selectClass}>
          <option value="">{t("px.signup.choose", { defaultValue: "Choisir une formation" })}</option>
          {catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      {fieldErrors.course_id && <p className="mt-1 text-xs text-danger">{fieldErrors.course_id}</p>}
      {catalog.isError && (
        <div role="alert" className="mt-1 text-xs text-danger">
          {t("px.signup.catalog_error", { defaultValue: "Impossible de charger les formations." })}{" "}
          <button type="button" onClick={() => void catalog.refetch()} className="font-semibold underline">
            {t("px.signup.retry", { defaultValue: "Réessayer" })}
          </button>
        </div>
      )}
    </div>
  )

  const emailField = (
    <FormField
      label={t("auth.email")} type="email" required autoComplete="email" inputMode="email"
      hint={emailFix ? t("px.signup.email_fix", { defaultValue: "Vouliez-vous écrire {{email}} ?", email: emailFix }) : undefined}
      value={email} onChange={(v) => { setEmail(v); clearErr("email") }} error={fieldErrors.email}
    />
  )

  const messageField = (
    <label className="block text-sm font-medium">
      {t("px.signup.message", { defaultValue: "Message pour l'équipe (facultatif)" })}
      <textarea
        rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder={t("px.signup.message_ph", { defaultValue: "Votre niveau, vos objectifs, une question..." })}
        className={selectClass}
      />
    </label>
  )

  const stepTitles = [
    { title: t("px.signup.s1_title", { defaultValue: "Choisissez votre formation" }), hint: t("px.signup.s1_hint", { defaultValue: "Sélectionnez la formation et dites-nous comment vous appeler." }) },
    { title: t("px.signup.s2_title", { defaultValue: "Qui êtes-vous ?" }), hint: t("px.signup.s2_hint", { defaultValue: "Ces informations figureront sur votre certificat." }) },
    { title: t("px.signup.s3_title", { defaultValue: "Comment vous joindre ?" }), hint: t("px.signup.s3_hint", { defaultValue: "Votre numéro nous sert à vous contacter, de préférence sur WhatsApp." }) },
    { title: t("px.signup.s4_title", { defaultValue: "Créez votre compte" }), hint: t("px.signup.s4_hint", { defaultValue: "Dernière étape : vos identifiants de connexion." }) },
  ]

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

      {mode === "signup" && <Stepper step={step} labels={stepLabels} />}

      <form ref={formRef} noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        {mode === "signup" && (
          <div>
            <h2 className="text-lg font-bold">{stepTitles[step].title}</h2>
            <p className="mt-0.5 text-sm text-muted">{stepTitles[step].hint}</p>
          </div>
        )}

        {mode === "login" && (
          <>
            {courseField}
            {emailField}
            <FormField
              label={t("auth.password")} type="password" required minLength={8} autoComplete="current-password"
              value={password} onChange={(v) => { setPassword(v); clearErr("password") }} error={fieldErrors.password}
            />
            {messageField}
          </>
        )}

        {mode === "signup" && step === 0 && (
          <div key="s0" className="space-y-5">
            {courseField}
            {chosen && (
              <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
                {t("px.signup.you_chose", { defaultValue: "Formation choisie :" })} <strong>{chosen.title}</strong>
              </p>
            )}
            <FormField label={t("px.signup.fullname", { defaultValue: "Prénom et nom" })} required autoComplete="name" value={name} onChange={(v) => { setName(v); clearErr("name") }} error={fieldErrors.name} />
          </div>
        )}

        {mode === "signup" && step === 1 && (
          <div key="s1" className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
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
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <CountrySelect
                label={t("px.signup.birth_country", { defaultValue: "Pays de naissance" })} placeholder={choose} countries={countries}
                value={profile.birth_country} onChange={(v) => pickCountry("birth_country", v)} error={fieldErrors.birth_country}
              />
              <CityInput
                id="px-birth-place" label={t("px.signup.birth_place", { defaultValue: "Lieu de naissance (ville)" })}
                value={profile.birth_place} onChange={setP("birth_place")} error={fieldErrors.birth_place} cities={citiesFor(profile.birth_country)} country={profile.birth_country}
              />
            </div>
            <CountrySelect
              label={t("px.signup.nationality", { defaultValue: "Nationalité (pays du passeport)" })} placeholder={choose} countries={countries}
              value={profile.nationality} onChange={(v) => pickCountry("nationality", v)} error={fieldErrors.nationality}
            />
          </div>
        )}

        {mode === "signup" && step === 2 && (
          <div key="s2" className="space-y-5">
            <PhoneIntl
              label={t("px.signup.phone", { defaultValue: "Téléphone (WhatsApp de préférence)" })}
              value={phone} onChange={(v) => { setPhone(v); clearErr("phone") }}
              country={phoneCountry} onCountry={(c) => { setPhoneCountry(c); clearErr("phone") }}
              options={phoneOpts} error={fieldErrors.phone}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <CountrySelect
                label={t("px.signup.country", { defaultValue: "Pays de résidence" })} placeholder={choose} countries={countries}
                value={profile.country} onChange={(v) => pickCountry("country", v)} error={fieldErrors.country}
              />
              <CityInput
                id="px-city" label={t("px.signup.city", { defaultValue: "Ville de résidence" })}
                value={profile.city} onChange={setP("city")} error={fieldErrors.city} cities={citiesFor(profile.country)} country={profile.country}
              />
            </div>
            <FormField label={t("px.signup.address", { defaultValue: "Adresse (facultatif)" })} autoComplete="street-address" value={profile.address} onChange={setP("address")} error={fieldErrors.address} />
            <FormField label={t("px.signup.profession", { defaultValue: "Profession ou niveau d'études (facultatif)" })} value={profile.profession} onChange={setP("profession")} error={fieldErrors.profession} />
          </div>
        )}

        {mode === "signup" && step === 3 && (
          <div key="s3" className="space-y-5">
            {emailField}
            <FormField
              label={t("auth.password")} type="password" required minLength={8} autoComplete="new-password"
              hint={t("auth.password_hint")} value={password} onChange={(v) => { setPassword(v); clearErr("password") }} error={fieldErrors.password}
            />
            <FormField
              label={t("auth.confirm_password")} type="password" required minLength={8} autoComplete="new-password"
              value={confirmation} onChange={(v) => { setConfirmation(v); clearErr("password_confirmation") }}
              error={fieldErrors.password_confirmation ?? (liveMismatch ? t("auth.password_mismatch") : undefined)}
            />
            {messageField}
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {mode === "login" ? (
          <Button type="submit" size="lg" full loading={loading}>
            {t("px.signup.submit_login", { defaultValue: "Me connecter et demander l'accès" })}
          </Button>
        ) : (
          <div className="flex items-center gap-3 border-t border-line pt-5">
            {step > 0 && (
              <button
                key="prev" type="button" onClick={() => goTo(step - 1)} disabled={loading}
                className="min-h-[48px] rounded-lg border border-line bg-surface px-5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 disabled:opacity-50"
              >
                ← {t("px.signup.prev", { defaultValue: "Précédent" })}
              </button>
            )}
            {step < LAST ? (
              <button
                key="next" type="button" onClick={next}
                className="min-h-[48px] flex-1 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95"
              >
                {t("px.signup.next", { defaultValue: "Suivant" })} →
              </button>
            ) : (
              <div key="submit" className="flex-1">
                <Button type="submit" size="lg" full loading={loading} disabled={liveMismatch}>
                  {t("px.signup.submit", { defaultValue: "Créer mon compte et demander l'accès" })}
                </Button>
              </div>
            )}
          </div>
        )}
      </form>

      <p className="text-center text-sm text-muted">
        {mode === "signup" ? t("auth.already") : t("auth.no_account")}{" "}
        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setStep(0); setError(null); setFieldErrors({}) }}
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