$ErrorActionPreference = "Stop"
if (-not (Test-Path .\artisan)) { Write-Host "Lancez ce script depuis C:\Unix (le dossier qui contient 'artisan')." -ForegroundColor Red; exit 1 }
if (-not (Test-Path .\frontend\src\components\PortalLogin.tsx) -or -not (Test-Path .\frontend\src\pages\admin\AdminFormationsPage.tsx)) {
  Write-Host "Lancez d'abord setup-formations.ps1 puis setup-portails.ps1 : ce script traduit leurs pages." -ForegroundColor Red
  exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding $false

function Patch($path, $old, $new, $marker = $null) {
  $p = (Resolve-Path $path).Path
  $c = [IO.File]::ReadAllText($p, $utf8).Replace("`r`n", "`n")
  $old = $old.Replace("`r`n", "`n")
  $new = $new.Replace("`r`n", "`n")
  if ($marker -and $c.Contains($marker)) { Write-Host "DEJA FAIT : $path ($marker)"; return }
  if (-not $c.Contains($old)) { Write-Host "NON TROUVE : $path -> $old" -ForegroundColor Yellow; return }
  if (-not (Test-Path "$p.bak5")) { Copy-Item $p "$p.bak5" -Force }
  [IO.File]::WriteAllText($p, $c.Replace($old, $new), $utf8)
  Write-Host "OK : $path"
}

function Put($rel, $content) {
  $full = Join-Path (Get-Location) $rel
  $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  if ((Test-Path $full) -and -not (Test-Path "$full.bak5")) { Copy-Item $full "$full.bak5" -Force }
  [IO.File]::WriteAllText($full, $content, $utf8)
  Write-Host "ECRIT : $rel"
}

Write-Host "=== BACKEND : messages d'erreur FR/EN ===" -ForegroundColor Cyan

$langRoot = "lang"
if ((-not (Test-Path .\lang)) -and (Test-Path .\resources\lang)) { $langRoot = "resources\lang" }
Write-Host "Dossier de langues : $langRoot"

Put "$langRoot\fr\portal.php" @'
<?php

return [
    'wrong_password' => "Mot de passe actuel incorrect.",
    'name_required' => "Le nom est obligatoire pour cr\u{e9}er un nouveau compte.",
    'account_blocked' => "Ce compte est bloqu\u{e9}.",
    'account_blocked_first' => "Ce compte est bloqu\u{e9} : d\u{e9}bloquez-le d'abord.",
    'already_enrolled' => "Cette personne est d\u{e9}j\u{e0} inscrite \u{e0} ce cours.",
];
'@

Put "$langRoot\en\portal.php" @'
<?php

return [
    'wrong_password' => 'Current password is incorrect.',
    'name_required' => 'A name is required to create a new account.',
    'account_blocked' => 'This account is blocked.',
    'account_blocked_first' => 'This account is blocked: unblock it first.',
    'already_enrolled' => 'This person is already enrolled in this course.',
];
'@

$fc = ".\app\Http\Controllers\Admin\FormationsController.php"
Patch $fc '"Le nom est obligatoire pour cr\u{e9}er un nouveau compte."' "__('portal.name_required')" "portal.name_required"
Patch $fc '"Ce compte est bloqu\u{e9} : d\u{e9}bloquez-le d''abord."' "__('portal.account_blocked_first')" "portal.account_blocked_first"
Patch $fc '"Ce compte est bloqu\u{e9}."' "__('portal.account_blocked')" "portal.account_blocked'"
Patch $fc '"Cette personne est d\u{e9}j\u{e0} inscrite \u{e0} ce cours."' "__('portal.already_enrolled')" "portal.already_enrolled"
Patch ".\app\Http\Controllers\Api\ProfileController.php" "'Mot de passe actuel incorrect.'" "__('portal.wrong_password')" "portal.wrong_password"

Put "tests\Feature\PortalTranslationsTest.php" @'
<?php

namespace Tests\Feature;

use Tests\TestCase;

class PortalTranslationsTest extends TestCase
{
    public function test_portal_messages_exist_in_french_and_english(): void
    {
        foreach (['wrong_password', 'name_required', 'account_blocked', 'account_blocked_first', 'already_enrolled'] as $key) {
            $fr = __('portal.'.$key, [], 'fr');
            $en = __('portal.'.$key, [], 'en');

            $this->assertNotSame('portal.'.$key, $fr);
            $this->assertNotSame('portal.'.$key, $en);
            $this->assertNotSame($fr, $en);
        }
    }
}
'@

php -l .\app\Http\Controllers\Admin\FormationsController.php
php -l .\app\Http\Controllers\Api\ProfileController.php
php artisan config:clear | Out-Null

Write-Host "=== FRONTEND : dictionnaire FR/EN ===" -ForegroundColor Cyan

Put "frontend\src\lib\extraTranslations.ts" @'
import i18n from "../i18n"

// Textes des nouvelles pages (compte, formations, portails). Ajoutes aux traductions existantes
// sans les ecraser. "en" est type comme "fr" : une cle manquante dans l'une des deux langues
// fait echouer la compilation (npx tsc -b).

const fr = {
  px: {
    nav: {
      my_account: "Mon compte",
      student_space: "Espace \u00e9tudiant",
    },
    checkout: {
      deliver_to: "Livrer \u00e0",
      other_address: "Autre personne / autre adresse",
      edit_hint: "Vous pouvez modifier les champs ci-dessous pour cette commande.",
      save_address: "Enregistrer cette adresse dans mon compte",
    },
    account: {
      title: "Mon compte",
      orders: "Mes commandes",
      courses: "Mes cours",
      tab_profile: "Profil",
      tab_addresses: "Adresses",
      tab_security: "S\u00e9curit\u00e9",
      profile: "Informations personnelles",
      full_name: "Nom complet",
      email: "E-mail",
      phone: "T\u00e9l\u00e9phone",
      save: "Enregistrer",
      saved: "Enregistr\u00e9",
      addresses: "Mes adresses de livraison",
      addresses_hint: "Utilis\u00e9es pour pr\u00e9-remplir vos commandes. Vous pouvez aussi livrer \u00e0 une autre personne au moment de commander.",
      none: "Aucune adresse enregistr\u00e9e.",
      add: "Ajouter une adresse",
      edit: "Modifier",
      remove: "Supprimer",
      confirm_remove: "Supprimer cette adresse ?",
      label: "Nom de l'adresse (Maison, Bureau, Pour ma m\u00e8re...)",
      recipient: "Nom du destinataire",
      city: "Ville",
      district: "Quartier (facultatif)",
      address: "Adresse",
      landmark: "Point de rep\u00e8re (facultatif)",
      make_default: "Utiliser par d\u00e9faut",
      default_tag: "Par d\u00e9faut",
      cancel: "Annuler",
      next: "Suivant",
      back: "Retour",
      step_of: "\u00c9tape {{n}}/3",
      step_recipient: "Destinataire",
      step_place: "Lieu de livraison",
      step_confirm: "V\u00e9rification",
      password: "Mot de passe",
      current: "Mot de passe actuel",
      new_pwd: "Nouveau mot de passe (8 caract\u00e8res min.)",
      confirm_pwd: "Confirmer le nouveau mot de passe",
      change_pwd: "Changer le mot de passe",
      pwd_changed: "Mot de passe modifi\u00e9",
    },
    fm: {
      title: "Formations",
      add_student: "Ajouter / relier un \u00e9tudiant",
      enroll: "Inscrire \u00e0 un cours",
      close: "Fermer",
      new_label: "Nouveau",
      stable: "Stable",
      vs: "vs 30 jours pr\u00e9c\u00e9dents",
      k_students: "\u00c9tudiants",
      k_students_hint: "{{n}} actif(s) sur 30 jours",
      k_enrollments: "Inscriptions",
      k_completion: "Taux d'ach\u00e8vement",
      k_avg: "Progression moyenne",
      k_completed: "Formations termin\u00e9es",
      k_certs: "Certificats d\u00e9livr\u00e9s",
      k_courses: "Cours publi\u00e9s",
      k_courses_hint: "{{n}} avec session en direct",
      k_no_course: "\u00c9tudiants sans cours",
      todo: "\u00c0 traiter",
      nothing: "Rien \u00e0 traiter pour le moment.",
      stalled: "Sans activit\u00e9 depuis 14 jours",
      stalled_total: "{{n}} au total",
      last_activity: "Derni\u00e8re activit\u00e9",
      to_enroll: "\u00c9tudiants \u00e0 inscrire \u00e0 un cours",
      enroll_btn: "Inscrire",
      top_courses: "Cours les plus suivis",
      no_courses: "Aucun cours pour le moment.",
      completed_of: "{{done}}/{{total}} termin\u00e9(s)",
      draft: "Brouillon",
      recent: "Derni\u00e8res inscriptions",
      no_enrollments: "Aucune inscription pour le moment.",
      see_all: "Tout voir",
      manage_courses: "G\u00e9rer les cours",
      manage_users: "G\u00e9rer les comptes",
      email: "E-mail",
      name: "Nom complet",
      name_hint: "Utile seulement si le compte n'existe pas encore.",
      phone_optional: "T\u00e9l\u00e9phone (facultatif)",
      course: "Cours",
      course_optional: "Inscrire aussi \u00e0 un cours (facultatif)",
      none: "Aucun",
      choose: "Choisir un cours",
      submit_student: "Valider",
      submit_enroll: "Inscrire",
      panel_student_hint: "Si l'e-mail correspond \u00e0 un compte existant (client de la boutique), il est simplement reli\u00e9 : m\u00eame compte, acc\u00e8s aux formations activ\u00e9. Sinon un compte est cr\u00e9\u00e9 et un e-mail est envoy\u00e9 pour choisir son mot de passe.",
      search: "Rechercher un nom ou un e-mail (2 lettres min.)",
      student: "\u00c9tudiant",
      change_person: "Changer",
      created_mail: "Compte cr\u00e9\u00e9. Un e-mail a \u00e9t\u00e9 envoy\u00e9 pour choisir son mot de passe.",
      created_no_mail: "Compte cr\u00e9\u00e9, mais l'e-mail n'a pas pu partir. Utilisez \u00ab mot de passe oubli\u00e9 \u00bb pour lui envoyer le lien.",
      linked: "Compte existant reli\u00e9 : acc\u00e8s aux formations activ\u00e9 ({{n}} commande(s) en boutique).",
      enrolled: "Inscription enregistr\u00e9e.",
    },
    stu: {
      k_courses: "Formations",
      k_active: "En cours",
      k_done: "Termin\u00e9es",
      k_certs: "Certificats",
      overall: "Progression globale",
      resume: "Reprendre l'apprentissage",
      section_active: "En cours",
      section_done: "Termin\u00e9es",
    },
    portal: {
      logout: "Se d\u00e9connecter",
      shop: "Retour \u00e0 la boutique",
      student_brand: "Espace \u00e9tudiant",
      student_title: "Connexion \u00e9tudiant",
      student_subtitle: "Retrouvez vos formations, votre progression et vos certificats.",
      student_denied: "Ce compte n'a pas encore acc\u00e8s aux formations. Contactez-nous pour l'activer.",
      ask_access: "Pas encore d'acc\u00e8s ? Demandez-le-nous",
      ask_access_short: "Demander l'acc\u00e8s",
      wa_message: "Bonjour, je souhaite acc\u00e9der aux formations.",
      wa_message_email: "Bonjour, je souhaite acc\u00e9der aux formations. Mon e-mail : ",
      admin_brand: "Administration",
      admin_title: "Connexion administrateur",
      admin_subtitle: "Espace r\u00e9serv\u00e9 \u00e0 l'\u00e9quipe.",
      admin_denied: "Ce compte n'a pas les droits d'administration.",
      nav_dashboard: "Tableau de bord",
      nav_catalog: "Catalogue",
      nav_admin: "Administration",
      footer: "Espace \u00e9tudiant",
    },
  },
  admin: {
    formations: "Formations",
  },
}

const en: typeof fr = {
  px: {
    nav: {
      my_account: "My account",
      student_space: "Student area",
    },
    checkout: {
      deliver_to: "Deliver to",
      other_address: "Someone else / another address",
      edit_hint: "You can edit the fields below for this order.",
      save_address: "Save this address to my account",
    },
    account: {
      title: "My account",
      orders: "My orders",
      courses: "My courses",
      tab_profile: "Profile",
      tab_addresses: "Addresses",
      tab_security: "Security",
      profile: "Personal information",
      full_name: "Full name",
      email: "Email",
      phone: "Phone",
      save: "Save",
      saved: "Saved",
      addresses: "My delivery addresses",
      addresses_hint: "Used to pre-fill your orders. You can also deliver to someone else when you check out.",
      none: "No saved address.",
      add: "Add an address",
      edit: "Edit",
      remove: "Delete",
      confirm_remove: "Delete this address?",
      label: "Address name (Home, Office, For my mother...)",
      recipient: "Recipient name",
      city: "City",
      district: "District (optional)",
      address: "Address",
      landmark: "Landmark (optional)",
      make_default: "Use as default",
      default_tag: "Default",
      cancel: "Cancel",
      next: "Next",
      back: "Back",
      step_of: "Step {{n}}/3",
      step_recipient: "Recipient",
      step_place: "Delivery place",
      step_confirm: "Review",
      password: "Password",
      current: "Current password",
      new_pwd: "New password (8 characters min.)",
      confirm_pwd: "Confirm the new password",
      change_pwd: "Change password",
      pwd_changed: "Password changed",
    },
    fm: {
      title: "Training",
      add_student: "Add / link a student",
      enroll: "Enroll in a course",
      close: "Close",
      new_label: "New",
      stable: "Stable",
      vs: "vs previous 30 days",
      k_students: "Students",
      k_students_hint: "{{n}} active in the last 30 days",
      k_enrollments: "Enrollments",
      k_completion: "Completion rate",
      k_avg: "Average progress",
      k_completed: "Completed courses",
      k_certs: "Certificates issued",
      k_courses: "Published courses",
      k_courses_hint: "{{n}} with a live session",
      k_no_course: "Students without a course",
      todo: "To do",
      nothing: "Nothing to do right now.",
      stalled: "No activity for 14 days",
      stalled_total: "{{n}} in total",
      last_activity: "Last activity",
      to_enroll: "Students to enroll in a course",
      enroll_btn: "Enroll",
      top_courses: "Most followed courses",
      no_courses: "No courses yet.",
      completed_of: "{{done}}/{{total}} completed",
      draft: "Draft",
      recent: "Latest enrollments",
      no_enrollments: "No enrollments yet.",
      see_all: "See all",
      manage_courses: "Manage courses",
      manage_users: "Manage accounts",
      email: "Email",
      name: "Full name",
      name_hint: "Only needed if the account does not exist yet.",
      phone_optional: "Phone (optional)",
      course: "Course",
      course_optional: "Also enroll in a course (optional)",
      none: "None",
      choose: "Choose a course",
      submit_student: "Confirm",
      submit_enroll: "Enroll",
      panel_student_hint: "If the email matches an existing account (a shop customer), it is simply linked: same account, training access enabled. Otherwise an account is created and an email is sent so the person can choose a password.",
      search: "Search by name or email (2 letters min.)",
      student: "Student",
      change_person: "Change",
      created_mail: "Account created. An email was sent so the person can choose a password.",
      created_no_mail: "Account created, but the email could not be sent. Use \"forgot password\" to send them the link.",
      linked: "Existing account linked: training access enabled ({{n}} shop order(s)).",
      enrolled: "Enrollment saved.",
    },
    stu: {
      k_courses: "Courses",
      k_active: "In progress",
      k_done: "Completed",
      k_certs: "Certificates",
      overall: "Overall progress",
      resume: "Pick up where you left off",
      section_active: "In progress",
      section_done: "Completed",
    },
    portal: {
      logout: "Log out",
      shop: "Back to the shop",
      student_brand: "Student area",
      student_title: "Student login",
      student_subtitle: "Find your courses, your progress and your certificates.",
      student_denied: "This account does not have access to the courses yet. Contact us to activate it.",
      ask_access: "No access yet? Ask us",
      ask_access_short: "Request access",
      wa_message: "Hello, I would like access to the courses.",
      wa_message_email: "Hello, I would like access to the courses. My email: ",
      admin_brand: "Administration",
      admin_title: "Administrator login",
      admin_subtitle: "Area reserved for the team.",
      admin_denied: "This account does not have administrator rights.",
      nav_dashboard: "Dashboard",
      nav_catalog: "Catalog",
      nav_admin: "Administration",
      footer: "Student area",
    },
  },
  admin: {
    formations: "Training",
  },
}

function register() {
  const ns = typeof i18n.options.defaultNS === "string" ? i18n.options.defaultNS : "translation"
  // deep = true, overwrite = false : on complete les traductions existantes sans rien ecraser
  i18n.addResourceBundle("fr", ns, fr, true, false)
  i18n.addResourceBundle("en", ns, en, true, false)
}

if (i18n.store) register()
else i18n.on("initialized", register)
'@

Patch ".\frontend\src\App.tsx" 'import { useQueryClient } from "@tanstack/react-query"' ('import { useQueryClient } from "@tanstack/react-query"' + "`n" + 'import "./lib/extraTranslations"') "extraTranslations"

Write-Host "=== FRONTEND : pages traduites ===" -ForegroundColor Cyan

Put "frontend\src\pages\AccountPage.tsx" @'
import { useEffect, useState, type FormEvent } from "react"
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
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  useEffect(() => {
    if (me.data) { setName(me.data.name); setPhone(me.data.phone ?? "") }
  }, [me.data])

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
'@

Put "frontend\src\pages\admin\AdminFormationsPage.tsx" @'
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "../../api/admin"
import { formationsApi, type Metric } from "../../api/formations"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import Button from "../../components/Button"

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const card = "rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"

interface Picked { id: number; name: string; email: string }

function Delta({ m }: { m: Metric }) {
  const { t } = useTranslation()
  if (m.change === null) return <span className="text-xs text-muted">{t("px.fm.new_label")}</span>
  if (m.change === 0) return <span className="text-xs text-muted">{t("px.fm.stable")}</span>
  const up = m.change > 0
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-danger"}`}>
      {up ? "\u25b2" : "\u25bc"} {Math.abs(m.change)} %
    </span>
  )
}

function Kpi({ label, value, tone = "", foot }: { label: string; value: string | number; tone?: string; foot?: ReactNode }) {
  return (
    <div className="h-full rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
      <div className="mt-1 min-h-4 text-xs text-muted">{foot}</div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

function useRefreshAll() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin-formations"] })
    void qc.invalidateQueries({ queryKey: ["admin-users"] })
    void qc.invalidateQueries({ queryKey: ["admin-enrollments"] })
  }
}

function StudentPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const refresh = useRefreshAll()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [courseId, setCourseId] = useState("")
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => (await adminApi.courses(1)).data.data,
  })

  const save = useMutation({
    mutationFn: () =>
      formationsApi.createStudent({
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        course_id: courseId ? Number(courseId) : undefined,
      }),
    onSuccess: ({ data }) => {
      if (data.created) toast.success(data.mail_sent ? t("px.fm.created_mail") : t("px.fm.created_no_mail"))
      else toast.success(t("px.fm.linked", { n: data.orders_count }))
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }} className={`${card} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{t("px.fm.add_student")}</h3>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">{t("px.fm.close")}</button>
      </div>
      <p className="text-sm text-muted">{t("px.fm.panel_student_hint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("px.fm.email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("px.fm.name")}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-muted">{t("px.fm.name_hint")}</span>
        </label>
        <label className="block text-sm font-medium">
          {t("px.fm.phone_optional")}
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("px.fm.course_optional")}
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
            <option value="">{t("px.fm.none")}</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      <Button type="submit" size="lg" loading={save.isPending}>{t("px.fm.submit_student")}</Button>
    </form>
  )
}

function EnrollPanel({ initial, onClose }: { initial: Picked | null; onClose: () => void }) {
  const { t } = useTranslation()
  const refresh = useRefreshAll()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Picked | null>(initial)
  const [courseId, setCourseId] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350)
    return () => clearTimeout(id)
  }, [input])

  const users = useQuery({
    queryKey: ["admin-users-pick", q],
    queryFn: async () => (await adminApi.users(1, q)).data.data,
    enabled: q.length >= 2 && !picked,
  })
  const courses = useQuery({
    queryKey: ["admin-courses-pick"],
    queryFn: async () => (await adminApi.courses(1)).data.data,
  })

  const save = useMutation({
    mutationFn: () => formationsApi.enroll({ user_id: picked!.id, course_id: Number(courseId) }),
    onSuccess: () => {
      toast.success(t("px.fm.enrolled"))
      refresh()
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (picked && courseId) save.mutate() }}
      className={`${card} space-y-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{t("px.fm.enroll")}</h3>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">{t("px.fm.close")}</button>
      </div>

      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">{picked.name}</p>
            <p className="truncate text-muted">{picked.email}</p>
          </div>
          <button type="button" onClick={() => setPicked(null)} className="font-semibold text-primary hover:underline">{t("px.fm.change_person")}</button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("px.fm.search")}
            className={inputClass}
          />
          {users.data && users.data.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
              {users.data.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setPicked({ id: u.id, name: u.name, email: u.email })}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-page"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                    {u.is_student && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("px.fm.student")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block text-sm font-medium">
        {t("px.fm.course")}
        <select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
          <option value="">{t("px.fm.choose")}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <Button type="submit" size="lg" loading={save.isPending} disabled={!picked || !courseId}>{t("px.fm.submit_enroll")}</Button>
    </form>
  )
}

export default function AdminFormationsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [panel, setPanel] = useState<"student" | "enroll" | null>(null)
  const [pick, setPick] = useState<Picked | null>(null)

  const q = useQuery({
    queryKey: ["admin-formations"],
    queryFn: async () => (await formationsApi.dashboard()).data.data,
    staleTime: 30_000,
  })

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "-")

  function openEnroll(p: Picked | null) {
    setPick(p)
    setPanel("enroll")
  }

  const d = q.data
  const s = d?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{t("px.fm.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPanel(panel === "student" ? null : "student")}>{t("px.fm.add_student")}</Button>
          <Button variant="secondary" onClick={() => openEnroll(null)}>{t("px.fm.enroll")}</Button>
        </div>
      </div>

      {panel === "student" && <StudentPanel onClose={() => setPanel(null)} />}
      {panel === "enroll" && <EnrollPanel key={pick?.id ?? "none"} initial={pick} onClose={() => setPanel(null)} />}

      {q.error && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}

      {q.isLoading && (
        <div role="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      )}

      {d && s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t("px.fm.k_students")} value={s.students_total} foot={t("px.fm.k_students_hint", { n: s.active_students_30d })} />
            <Kpi label={t("px.fm.k_enrollments")} value={s.enrollments_total} foot={<><Delta m={d.period.enrollments} /> <span>{t("px.fm.vs")}</span></>} />
            <Kpi label={t("px.fm.k_completion")} value={`${s.completion_rate} %`} tone="text-primary" foot={`${s.completed} / ${s.enrollments_total}`} />
            <Kpi label={t("px.fm.k_avg")} value={`${s.avg_progress} %`} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t("px.fm.k_completed")} value={s.completed} foot={<><Delta m={d.period.completed} /> <span>{t("px.fm.vs")}</span></>} />
            <Kpi label={t("px.fm.k_certs")} value={s.certificates_total} foot={<><Delta m={d.period.certificates} /> <span>{t("px.fm.vs")}</span></>} />
            <Kpi label={t("px.fm.k_courses")} value={`${s.courses_published} / ${s.courses_total}`} foot={t("px.fm.k_courses_hint", { n: s.courses_live })} />
            <Kpi label={t("px.fm.k_no_course")} value={s.students_without_course} tone={s.students_without_course > 0 ? "text-accent" : ""} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t("px.fm.todo")}>
              {d.stalled.length === 0 && d.to_enroll.length === 0 ? (
                <p className="text-sm text-muted">{t("px.fm.nothing")}</p>
              ) : (
                <div className="space-y-5">
                  {d.to_enroll.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">{t("px.fm.to_enroll")}</p>
                      <ul className="divide-y divide-line text-sm">
                        {d.to_enroll.map((u) => (
                          <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0">
                              <span className="block font-medium">{u.name}</span>
                              <span className="block truncate text-xs text-muted">{u.email}</span>
                            </span>
                            <button type="button" onClick={() => openEnroll(u)} className="min-h-[44px] shrink-0 px-2 font-semibold text-primary hover:underline">
                              {t("px.fm.enroll_btn")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.stalled.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">
                        {t("px.fm.stalled")} <span className="font-normal text-muted">({t("px.fm.stalled_total", { n: d.stalled_count })})</span>
                      </p>
                      <ul className="divide-y divide-line text-sm">
                        {d.stalled.map((e) => (
                          <li key={e.id} className="py-2">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate font-medium">{e.user_name ?? "-"}</span>
                              <span className="shrink-0 text-xs text-muted">{e.progress} %</span>
                            </div>
                            <p className="truncate text-xs text-muted">{e.course_title} &middot; {t("px.fm.last_activity")} : {fmt(e.last_activity)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card title={t("px.fm.top_courses")} action={<Link to="/admin/cours" className="text-sm font-semibold text-primary hover:underline">{t("px.fm.manage_courses")}</Link>}>
              {d.top_courses.length === 0 ? (
                <p className="text-sm text-muted">{t("px.fm.no_courses")}</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {d.top_courses.map((c) => (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {c.title}
                          {!c.is_published && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-xs text-muted">{t("px.fm.draft")}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{c.enrollments} &middot; {t("px.fm.completed_of", { done: c.completed, total: c.enrollments })}</span>
                      </div>
                      <div className="mt-1"><Bar value={c.avg_progress} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={t("px.fm.recent")} action={<Link to="/admin/inscriptions" className="text-sm font-semibold text-primary hover:underline">{t("px.fm.see_all")}</Link>}>
            {d.recent.length === 0 ? (
              <p className="text-sm text-muted">{t("px.fm.no_enrollments")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {d.recent.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium">{e.user_name ?? "-"}</span>
                      <span className="block truncate text-xs text-muted">{e.course_title} &middot; {fmt(e.created_at)}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                      {e.progress} %
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/utilisateurs" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">{t("px.fm.manage_users")}</Link>
          </Card>
        </>
      )}
    </div>
  )
}
'@

Put "frontend\src\pages\MyCoursesPage.tsx" @'
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { coursesApi, downloadCertificate, type Enrollment } from "../api/courses"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { buttonClass } from "../components/Button"
import { EmptyState, ErrorState } from "../components/States"
import { ListSkeleton } from "../components/Skeleton"

type Row = Enrollment & { updated_at?: string }

export function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  )
}

function CertificateButton({ enrollment }: { enrollment: Enrollment }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const issue = useMutation({
    mutationFn: () => coursesApi.issueCertificate(enrollment.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-enrollments"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const cls = buttonClass({ size: "sm", variant: "secondary" })

  if (enrollment.certificate) {
    return (
      <button type="button" className={cls}
        onClick={() => void downloadCertificate(enrollment.certificate!.id).catch(() => toast.error(t("learn.certificate_error")))}>
        {t("learn.certificate_download")}
      </button>
    )
  }
  return (
    <button type="button" className={cls} disabled={issue.isPending} onClick={() => issue.mutate()}>
      {t("learn.certificate_get")}
    </button>
  )
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
    </div>
  )
}

function Item({ e }: { e: Row }) {
  const { t } = useTranslation()
  const done = e.progress >= 100 || !!e.completed_at
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 font-semibold">{e.course?.title}</h2>
        {done && <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{t("learn.completed")}</span>}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{t("learn.progress")}</span><span>{e.progress}%</span>
        </div>
        <Bar value={e.progress} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to={`/etudiant/cours/${e.id}`} className={buttonClass({ size: "sm" })}>
          {done ? t("learn.review") : e.progress > 0 ? t("learn.continue") : t("learn.start")}
        </Link>
        {done && <CertificateButton enrollment={e} />}
      </div>
    </li>
  )
}

export default function MyCoursesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => (await coursesApi.mine()).data.data,
    staleTime: 0,
  })

  const rows = (data ?? []) as Row[]
  const isDone = (e: Row) => e.progress >= 100 || !!e.completed_at
  const done = rows.filter(isDone)
  const active = rows.filter((e) => !isDone(e))
  const avg = rows.length > 0 ? Math.round(rows.reduce((n, e) => n + e.progress, 0) / rows.length) : 0
  const certs = rows.filter((e) => !!e.certificate).length
  const resume = [...active].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("learn.my_title")}</h1>
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState message={t("learn.my_empty")} actionTo="/etudiant/catalogue" actionLabel={t("learn.see_catalog")} />
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("px.stu.k_courses")} value={rows.length} />
            <Tile label={t("px.stu.k_active")} value={active.length} />
            <Tile label={t("px.stu.k_done")} value={done.length} />
            <Tile label={t("px.stu.k_certs")} value={certs} />
          </div>

          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{t("px.stu.overall")}</span>
              <span>{avg}%</span>
            </div>
            <Bar value={avg} />
          </div>

          {resume && (
            <div className="rounded-card border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase text-primary">{t("px.stu.resume")}</p>
              <p className="mt-1 font-semibold">{resume.course?.title}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1"><Bar value={resume.progress} /></div>
                <span className="text-xs text-muted">{resume.progress}%</span>
              </div>
              <Link to={`/etudiant/cours/${resume.id}`} className={buttonClass({ size: "sm", className: "mt-3" })}>
                {resume.progress > 0 ? t("learn.continue") : t("learn.start")}
              </Link>
            </div>
          )}

          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("px.stu.section_active")}</h2>
              <ul className="space-y-4">{active.map((e) => <Item key={e.id} e={e} />)}</ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("px.stu.section_done")}</h2>
              <ul className="space-y-4">{done.map((e) => <Item key={e.id} e={e} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
'@

Put "frontend\src\pages\StudentLoginPage.tsx" @'
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../components/PortalLogin"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

export default function StudentLoginPage() {
  const { t } = useTranslation()
  return (
    <PortalLogin
      brand={t("px.portal.student_brand")}
      title={t("px.portal.student_title")}
      subtitle={t("px.portal.student_subtitle")}
      home="/etudiant"
      allow={(u) => !!(u.is_student || u.is_admin)}
      denied={t("px.portal.student_denied")}
      logoutLabel={t("px.portal.logout")}
      footer={
        <>
          {WHATSAPP_NUMBER && (
            <p>
              <a href={whatsappUrl(t("px.portal.wa_message"))} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {t("px.portal.ask_access")}
              </a>
            </p>
          )}
          <p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link></p>
        </>
      }
    />
  )
}
'@

Put "frontend\src\pages\admin\AdminLoginPage.tsx" @'
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import PortalLogin from "../../components/PortalLogin"

export default function AdminLoginPage() {
  const { t } = useTranslation()
  return (
    <PortalLogin
      brand={t("px.portal.admin_brand")}
      title={t("px.portal.admin_title")}
      subtitle={t("px.portal.admin_subtitle")}
      home="/admin"
      allow={(u) => !!u.is_admin}
      denied={t("px.portal.admin_denied")}
      logoutLabel={t("px.portal.logout")}
      footer={<p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link></p>}
    />
  )
}
'@

Put "frontend\src\components\RequireStudentArea.tsx" @'
import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { ErrorState, LoadingState } from "./States"
import { PortalFrame } from "./PortalLogin"
import Button from "./Button"

// Garde de l'espace etudiant : renvoie vers SA page de connexion, jamais vers celle de la boutique.
export default function RequireStudentArea({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initError = useAuthStore((s) => s.initError)
  const init = useAuthStore((s) => s.init)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!user && initError) return <ErrorState error={initError} onRetry={() => void init()} />
  if (!user) return <Navigate to="/etudiant/connexion" state={{ from: location.pathname }} replace />

  if (!user.is_student && !user.is_admin) {
    return (
      <PortalFrame brand={t("px.portal.student_brand")}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{t("px.portal.student_denied")}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {WHATSAPP_NUMBER && (
            <a
              href={whatsappUrl(t("px.portal.wa_message_email") + user.email)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-semibold text-primary hover:underline"
            >
              {t("px.portal.ask_access_short")}
            </a>
          )}
          <Button variant="secondary" full onClick={() => void logout()}>{t("px.portal.logout")}</Button>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{t("px.portal.shop")}</Link>
        </p>
      </PortalFrame>
    )
  }

  return <>{children}</>
}
'@

Put "frontend\src\layouts\StudentLayout.tsx" @'
import { Suspense } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import PageLoader from "../components/PageLoader"
import ErrorBoundary from "../components/ErrorBoundary"
import PreferencesMenu from "../components/PreferencesMenu"

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${
    isActive ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
  }`

export default function StudentLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    toast.info(t("auth.logged_out"))
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/etudiant" className="text-lg font-extrabold tracking-tight text-primary">
            UNIX <span className="text-sm font-semibold text-muted">{t("px.portal.student_brand")}</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && <span className="hidden max-w-[14rem] truncate text-xs text-muted sm:inline">{user.email}</span>}
            <button type="button" onClick={() => void handleLogout()} className="min-h-[44px] text-sm font-medium text-muted transition-colors hover:text-ink">
              {t("nav.logout")}
            </button>
            <PreferencesMenu />
          </div>
        </div>
        <nav aria-label={t("px.portal.student_brand")} className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3">
          <NavLink to="/etudiant" end className={tab}>{t("px.portal.nav_dashboard")}</NavLink>
          <NavLink to="/etudiant/catalogue" className={tab}>{t("px.portal.nav_catalog")}</NavLink>
          <span className="ml-auto flex items-center gap-1">
            {user?.is_admin && <Link to="/admin" className="px-3 text-sm font-medium text-muted hover:text-ink">{t("px.portal.nav_admin")}</Link>}
            <Link to="/" className="px-3 text-sm font-medium text-muted hover:text-ink">{t("nav.shop")}</Link>
          </span>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoader />}>
            <div key={pathname} className="animate-fade-up"><Outlet /></div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-line bg-surface py-4 text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} UNIX &mdash; {t("px.portal.footer")}
      </footer>
    </div>
  )
}
'@

Write-Host "=== FRONTEND : textes ajoutes dans les pages existantes ===" -ForegroundColor Cyan

$co = ".\frontend\src\pages\CheckoutPage.tsx"
Patch $co '{"Livrer \u00e0"}' '{t("px.checkout.deliver_to")}' 'px.checkout.deliver_to'
Patch $co '{"Autre personne / autre adresse"}' '{t("px.checkout.other_address")}' 'px.checkout.other_address'
Patch $co '{"Vous pouvez modifier les champs ci-dessous pour cette commande."}' '{t("px.checkout.edit_hint")}' 'px.checkout.edit_hint'
Patch $co '<span>{"Enregistrer cette adresse dans mon compte"}</span>' '<span>{t("px.checkout.save_address")}</span>' 'px.checkout.save_address'

Patch ".\frontend\src\components\Navbar.tsx" 'Mon compte</NavLink>' '{t("px.nav.my_account")}</NavLink>' 'px.nav.my_account'
Patch ".\frontend\src\components\BottomNav.tsx" 'Mon compte' '{t("px.nav.my_account")}' 'px.nav.my_account'
Patch ".\frontend\src\components\Footer.tsx" '{"Espace \u00e9tudiant"}' '{t("px.nav.student_space")}' 'px.nav.student_space'

Write-Host "=== VERIFICATIONS ===" -ForegroundColor Cyan
Push-Location frontend
npx tsc -b
Pop-Location
php artisan test --filter="PortalTranslationsTest|AdminFormationsTest|StudentPortalTest|AccountApiTest|StudentAccessTest"

Write-Host ""
Write-Host "Termine. Basculez la langue (FR/EN) sur chaque page pour verifier. Collez-moi les erreurs / lignes NON TROUVE." -ForegroundColor Green