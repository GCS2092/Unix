import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, type Address, type AddressInput } from "../api/account"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { ErrorState, LoadingState } from "../components/States"
import Button from "../components/Button"

type Tab = "profil" | "adresses" | "securite"

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
const emptyAddress: AddressInput = {
  label: "", recipient_name: "", phone: "", city: "", district: "", address: "", landmark: "", is_default: false,
}

function Field(props: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; disabled?: boolean; auto?: string
}) {
  return (
    <label className="block text-sm font-medium">
      {props.label}
      <input
        type={props.type ?? "text"}
        required={props.required}
        disabled={props.disabled}
        autoComplete={props.auto}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`${inputClass} disabled:opacity-60`}
      />
    </label>
  )
}

function MiniSteps({ step }: { step: number }) {
  const { t } = useTranslation()
  const labels = [t("px.account.step_recipient"), t("px.account.step_place"), t("px.account.step_confirm")]
  return (
    <div>
      <p className="text-xs font-semibold text-muted">
        {t("px.account.step_of", { n: step })} &middot; <span className="text-ink">{labels[step - 1]}</span>
      </p>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
    </div>
  )
}

export default function AccountPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const canLearn = !!(authUser?.is_student || authUser?.is_admin)

  const tabs: { key: Tab; label: string }[] = [
    { key: "profil", label: t("px.account.tab_profile") },
    { key: "adresses", label: t("px.account.tab_addresses") },
    { key: "securite", label: t("px.account.tab_security") },
  ]

  // ---- Onglet courant (dans l'URL : /compte?onglet=adresses) ----
  const [params, setParams] = useSearchParams()
  const rawTab = params.get("onglet")
  const tab: Tab = rawTab === "adresses" || rawTab === "securite" ? rawTab : "profil"
  function goTab(k: Tab) {
    setParams(k === "profil" ? {} : { onglet: k }, { replace: true })
  }

  // ---- Profil ----
  const me = useQuery({ queryKey: ["account-me"], queryFn: async () => (await accountApi.me()).data.user })
  // Valeurs saisies ; tant que rien n'est saisi, on affiche celles du compte
  const [nameEdit, setName] = useState<string | null>(null)
  const [phoneEdit, setPhone] = useState<string | null>(null)
  const name = nameEdit ?? me.data?.name ?? ""
  const phone = phoneEdit ?? me.data?.phone ?? ""

  const saveProfile = useMutation({
    mutationFn: () => accountApi.updateProfile({ name, phone }),
    onSuccess: ({ data }) => {
      toast.success(t("px.account.saved"))
      if (authUser) useAuthStore.setState({ user: { ...authUser, name: data.user.name } })
      void queryClient.invalidateQueries({ queryKey: ["account-me"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  // ---- Adresses (assistant en 3 etapes) ----
  const list = useQuery({ queryKey: ["addresses"], queryFn: async () => (await accountApi.addresses()).data.data })
  const [editing, setEditing] = useState<Address | "new" | null>(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<AddressInput>(emptyAddress)
  const setF = (k: keyof AddressInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  function openForm(a: Address | "new") {
    setEditing(a)
    setStep(1)
    setForm(
      a === "new"
        ? { ...emptyAddress, recipient_name: name, phone }
        : {
            label: a.label ?? "", recipient_name: a.recipient_name, phone: a.phone, city: a.city,
            district: a.district ?? "", address: a.address, landmark: a.landmark ?? "", is_default: a.is_default,
          },
    )
  }
  function closeForm() {
    setEditing(null)
    setStep(1)
  }

  const saveAddress = useMutation({
    mutationFn: () =>
      editing && editing !== "new" ? accountApi.updateAddress(editing.id, form) : accountApi.createAddress(form),
    onSuccess: () => {
      toast.success(t("px.account.saved"))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ["addresses"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const removeAddress = useMutation({
    mutationFn: (id: number) => accountApi.deleteAddress(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function submitAddress(e: FormEvent) {
    e.preventDefault()
    if (step < 3) setStep(step + 1)
    else saveAddress.mutate()
  }

  // ---- Mot de passe ----
  const [cur, setCur] = useState("")
  const [pwd, setPwd] = useState("")
  const [pwd2, setPwd2] = useState("")
  const changePwd = useMutation({
    mutationFn: () => accountApi.updatePassword({ current_password: cur, password: pwd, password_confirmation: pwd2 }),
    onSuccess: () => { toast.success(t("px.account.pwd_changed")); setCur(""); setPwd(""); setPwd2("") },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (me.isLoading) return <LoadingState />
  if (me.error) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("px.account.title")}</h1>

      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link to="/commandes" className="min-h-[44px] rounded-lg border border-line px-4 py-3 text-primary hover:bg-primary/5">{t("px.account.orders")}</Link>
        {canLearn && (
          <Link to="/etudiant" className="min-h-[44px] rounded-lg border border-line px-4 py-3 text-primary hover:bg-primary/5">{t("px.account.courses")}</Link>
        )}
      </div>

      <div role="tablist" className="flex gap-1 rounded-lg bg-line/40 p-1">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => goTab(x.key)}
            className={`min-h-[44px] flex-1 rounded-md px-2 text-sm font-semibold transition ${
              tab === x.key ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "profil" && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); saveProfile.mutate() }} className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold">{t("px.account.profile")}</h2>
          <Field label={t("px.account.full_name")} value={name} onChange={setName} required auto="name" />
          <Field label={t("px.account.email")} value={me.data?.email ?? ""} onChange={() => undefined} disabled />
          <Field label={t("px.account.phone")} value={phone} onChange={setPhone} type="tel" auto="tel" />
          <Button type="submit" size="lg" loading={saveProfile.isPending}>{t("px.account.save")}</Button>
        </form>
      )}

      {tab === "adresses" && (
        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="text-lg font-semibold">{t("px.account.addresses")}</h2>
            <p className="text-sm text-muted">{t("px.account.addresses_hint")}</p>
          </div>

          {list.isLoading && <LoadingState />}
          {list.data && list.data.length === 0 && editing === null && <p className="text-sm text-muted">{t("px.account.none")}</p>}

          {editing === null && list.data && list.data.map((a) => (
            <div key={a.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {a.label || a.recipient_name}
                    {a.is_default && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("px.account.default_tag")}</span>}
                  </p>
                  <p className="text-muted">{a.recipient_name} &middot; {a.phone}</p>
                  <p className="text-muted">{[a.address, a.landmark, a.district, a.city].filter(Boolean).join(", ")}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button type="button" onClick={() => openForm(a)} className="min-h-[44px] font-semibold text-primary hover:underline">{t("px.account.edit")}</button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(t("px.account.confirm_remove"))) removeAddress.mutate(a.id) }}
                    className="min-h-[44px] font-semibold text-danger hover:underline"
                  >
                    {t("px.account.remove")}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {editing !== null ? (
            <form onSubmit={submitAddress} className="space-y-4 rounded-lg bg-page p-3">
              <MiniSteps step={step} />

              {step === 1 && (
                <div className="space-y-3">
                  <Field label={t("px.account.label")} value={form.label} onChange={(v) => setF("label", v)} />
                  <Field label={t("px.account.recipient")} value={form.recipient_name} onChange={(v) => setF("recipient_name", v)} required auto="name" />
                  <Field label={t("px.account.phone")} value={form.phone} onChange={(v) => setF("phone", v)} type="tel" required auto="tel" />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <Field label={t("px.account.city")} value={form.city} onChange={(v) => setF("city", v)} required auto="address-level2" />
                  <Field label={t("px.account.district")} value={form.district} onChange={(v) => setF("district", v)} />
                  <Field label={t("px.account.address")} value={form.address} onChange={(v) => setF("address", v)} required auto="street-address" />
                  <Field label={t("px.account.landmark")} value={form.landmark} onChange={(v) => setF("landmark", v)} />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="font-semibold">{form.label || form.recipient_name}</p>
                    <p className="text-muted">{form.recipient_name} &middot; {form.phone}</p>
                    <p className="text-muted">{[form.address, form.landmark, form.district, form.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.is_default} onChange={(e) => setF("is_default", e.target.checked)} />
                    {t("px.account.make_default")}
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                {step === 1 ? (
                  <button key="cancel" type="button" onClick={closeForm} className="min-h-[44px] rounded-lg border border-line px-4 font-semibold">{t("px.account.cancel")}</button>
                ) : (
                  <button key="back" type="button" onClick={() => setStep(step - 1)} className="min-h-[44px] rounded-lg border border-line px-4 font-semibold">{t("px.account.back")}</button>
                )}
                {step < 3 ? (
                  <Button key="next" type="submit" size="lg" className="flex-1">{t("px.account.next")}</Button>
                ) : (
                  <Button key="save" type="submit" size="lg" className="flex-1" loading={saveAddress.isPending}>{t("px.account.save")}</Button>
                )}
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => openForm("new")} className="min-h-[44px] w-full rounded-lg border border-dashed border-primary px-4 font-semibold text-primary hover:bg-primary/5">
              + {t("px.account.add")}
            </button>
          )}
        </section>
      )}

      {tab === "securite" && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); changePwd.mutate() }} className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold">{t("px.account.password")}</h2>
          <Field label={t("px.account.current")} value={cur} onChange={setCur} type="password" required auto="current-password" />
          <Field label={t("px.account.new_pwd")} value={pwd} onChange={setPwd} type="password" required auto="new-password" />
          <Field label={t("px.account.confirm_pwd")} value={pwd2} onChange={setPwd2} type="password" required auto="new-password" />
          <Button type="submit" size="lg" loading={changePwd.isPending}>{t("px.account.change_pwd")}</Button>
        </form>
      )}
    </div>
  )
}