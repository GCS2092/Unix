$ErrorActionPreference = "Stop"
if (-not (Test-Path .\artisan)) { Write-Host "Lancez ce script depuis C:\Unix (le dossier qui contient 'artisan')." -ForegroundColor Red; exit 1 }

$utf8 = New-Object System.Text.UTF8Encoding $false

function Patch($path, $old, $new, $marker = $null) {
  $p = (Resolve-Path $path).Path
  $c = [IO.File]::ReadAllText($p, $utf8).Replace("`r`n", "`n")
  $old = $old.Replace("`r`n", "`n")
  $new = $new.Replace("`r`n", "`n")
  if ($marker -and $c.Contains($marker)) { Write-Host "DEJA FAIT : $path ($marker)"; return }
  if (-not $c.Contains($old)) { Write-Host "NON TROUVE : $path -> $old" -ForegroundColor Yellow; return }
  if (-not (Test-Path "$p.bak4")) { Copy-Item $p "$p.bak4" -Force }
  [IO.File]::WriteAllText($p, $c.Replace($old, $new), $utf8)
  Write-Host "OK : $path"
}

function PatchRx($path, $pattern, $new, $marker = $null) {
  $p = (Resolve-Path $path).Path
  $c = [IO.File]::ReadAllText($p, $utf8).Replace("`r`n", "`n")
  if ($marker -and $c.Contains($marker)) { Write-Host "DEJA FAIT : $path ($marker)"; return }
  $m = [regex]::Match($c, $pattern)
  if (-not $m.Success) { Write-Host "NON TROUVE : $path -> $pattern" -ForegroundColor Yellow; return }
  if (-not (Test-Path "$p.bak4")) { Copy-Item $p "$p.bak4" -Force }
  $c2 = $c.Substring(0, $m.Index) + $new + $c.Substring($m.Index + $m.Length)
  [IO.File]::WriteAllText($p, $c2, $utf8)
  Write-Host "OK : $path"
}

function Put($rel, $content) {
  $full = Join-Path (Get-Location) $rel
  $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  if ((Test-Path $full) -and -not (Test-Path "$full.bak4")) { Copy-Item $full "$full.bak4" -Force }
  [IO.File]::WriteAllText($full, $content, $utf8)
  Write-Host "ECRIT : $rel"
}

Write-Host "=== BACKEND : le live visible pour les etudiants ===" -ForegroundColor Cyan

# CourseResource ne montrait livekit_room qu'aux admins : le lecteur n'affichait donc jamais le direct aux etudiants.
Patch ".\app\Http\Resources\CourseResource.php" `
  '''price'' => $this->price,' `
  ('''price'' => $this->price,' + "`n            " + '''has_live'' => filled($this->livekit_room),') `
  "'has_live'"

Put "tests\Feature\StudentPortalTest.php" @'
<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_sees_live_flag_without_room_name(): void
    {
        $student = User::factory()->student()->create();
        $course = Course::query()->create([
            'title' => 'Cours live',
            'slug' => 'cours-live-'.uniqid(),
            'price' => 0,
            'is_published' => true,
            'livekit_room' => 'salle-secrete',
        ]);
        Enrollment::query()->create(['user_id' => $student->id, 'course_id' => $course->id, 'progress' => 0]);

        Sanctum::actingAs($student);

        $this->getJson('/api/v1/enrollments')
            ->assertOk()
            ->assertJsonPath('data.0.course.has_live', true)
            ->assertJsonMissingPath('data.0.course.livekit_room');
    }
}
'@

php -l .\app\Http\Resources\CourseResource.php

Write-Host "=== FRONTEND : composants des portails ===" -ForegroundColor Cyan

Put "frontend\src\components\PortalLogin.tsx" @'
import { useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { getFieldErrors } from "../lib/fieldErrors"
import type { User } from "../types"
import Button from "./Button"
import FormField from "./FormField"
import PreferencesMenu from "./PreferencesMenu"
import { LoadingState } from "./States"

// Cadre commun des pages d'entree des portails (sans le menu de la boutique)
export function PortalFrame({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="text-lg font-extrabold tracking-tight text-primary">
          UNIX <span className="text-sm font-semibold text-muted">{brand}</span>
        </span>
        <PreferencesMenu />
      </header>
      <div className="mx-auto w-full max-w-sm px-4 py-6 sm:py-10">{children}</div>
    </div>
  )
}

export interface PortalLoginProps {
  brand: string
  title: string
  subtitle: string
  home: string
  allow: (u: User) => boolean
  denied: string
  logoutLabel: string
  footer?: ReactNode
}

export default function PortalLogin(p: PortalLoginProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const asked = (location.state as { from?: string } | null)?.from
  const from = asked && asked.startsWith(p.home) ? asked : p.home

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (authLoading) return <LoadingState />
  if (user && p.allow(user)) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      await login(email.trim(), password)
      const logged = useAuthStore.getState().user
      if (!logged || !p.allow(logged)) {
        // Identifiants valides, mais ce compte n'a pas acces a cet espace : on referme la session
        await logout().catch(() => undefined)
        setError(p.denied)
        setLoading(false)
        return
      }
      toast.success(t("auth.login_ok"))
      navigate(from, { replace: true })
    } catch (err) {
      const fields = getFieldErrors(err)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  // Deja connecte, mais avec un compte sans acces a cet espace
  if (user) {
    return (
      <PortalFrame brand={p.brand}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{p.denied}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <Button variant="secondary" full onClick={() => void logout()}>{p.logoutLabel}</Button>
        </div>
        {p.footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{p.footer}</div>}
      </PortalFrame>
    )
  }

  return (
    <PortalFrame brand={p.brand}>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{p.title}</h1>
        <p className="mt-2 text-sm text-muted">{p.subtitle}</p>
      </header>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <FormField label={t("auth.email")} type="email" required autoComplete="email" inputMode="email" autoFocus value={email} onChange={setEmail} error={fieldErrors.email} />

        <div>
          <FormField label={t("auth.password")} type="password" required autoComplete="current-password" value={password} onChange={setPassword} error={fieldErrors.password} />
          <div className="mt-2 text-right">
            <Link to="/mot-de-passe/oublie" className="text-xs font-semibold text-primary hover:underline">
              {t("auth.forgot_link")}
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" full loading={loading}>
          {loading ? t("auth.logging_in") : t("auth.login_btn")}
        </Button>
      </form>

      {p.footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{p.footer}</div>}
    </PortalFrame>
  )
}
'@

Put "frontend\src\pages\StudentLoginPage.tsx" @'
import { Link } from "react-router-dom"
import PortalLogin from "../components/PortalLogin"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

const T = {
  brand: "Espace \u00e9tudiant",
  title: "Connexion \u00e9tudiant",
  subtitle: "Retrouvez vos formations, votre progression et vos certificats.",
  denied: "Ce compte n'a pas encore acc\u00e8s aux formations. Contactez-nous pour l'activer.",
  logout: "Se d\u00e9connecter",
  askAccess: "Pas encore d'acc\u00e8s ? Demandez-le-nous",
  waMessage: "Bonjour, je souhaite acc\u00e9der aux formations.",
  shop: "Retour \u00e0 la boutique",
}

export default function StudentLoginPage() {
  return (
    <PortalLogin
      brand={T.brand}
      title={T.title}
      subtitle={T.subtitle}
      home="/etudiant"
      allow={(u) => !!(u.is_student || u.is_admin)}
      denied={T.denied}
      logoutLabel={T.logout}
      footer={
        <>
          {WHATSAPP_NUMBER && (
            <p>
              <a href={whatsappUrl(T.waMessage)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {T.askAccess}
              </a>
            </p>
          )}
          <p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link></p>
        </>
      }
    />
  )
}
'@

Put "frontend\src\pages\admin\AdminLoginPage.tsx" @'
import { Link } from "react-router-dom"
import PortalLogin from "../../components/PortalLogin"

const T = {
  brand: "Administration",
  title: "Connexion administrateur",
  subtitle: "Espace r\u00e9serv\u00e9 \u00e0 l'\u00e9quipe.",
  denied: "Ce compte n'a pas les droits d'administration.",
  logout: "Se d\u00e9connecter",
  shop: "Retour \u00e0 la boutique",
}

export default function AdminLoginPage() {
  return (
    <PortalLogin
      brand={T.brand}
      title={T.title}
      subtitle={T.subtitle}
      home="/admin"
      allow={(u) => !!u.is_admin}
      denied={T.denied}
      logoutLabel={T.logout}
      footer={<p><Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link></p>}
    />
  )
}
'@

Put "frontend\src\components\RequireStudentArea.tsx" @'
import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { ErrorState, LoadingState } from "./States"
import { PortalFrame } from "./PortalLogin"
import Button from "./Button"

const T = {
  brand: "Espace \u00e9tudiant",
  denied: "Ce compte n'a pas encore acc\u00e8s aux formations.",
  askAccess: "Demander l'acc\u00e8s",
  logout: "Se d\u00e9connecter",
  shop: "Retour \u00e0 la boutique",
  waMessage: "Bonjour, je souhaite acc\u00e9der aux formations. Mon e-mail : ",
}

// Garde de l'espace etudiant : renvoie vers SA page de connexion, jamais vers celle de la boutique.
export default function RequireStudentArea({ children }: { children: ReactNode }) {
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
      <PortalFrame brand={T.brand}>
        <div role="alert" className="space-y-4 rounded-card border border-line bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-sm text-danger">{T.denied}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {WHATSAPP_NUMBER && (
            <a
              href={whatsappUrl(T.waMessage + user.email)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-semibold text-primary hover:underline"
            >
              {T.askAccess}
            </a>
          )}
          <Button variant="secondary" full onClick={() => void logout()}>{T.logout}</Button>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="font-semibold text-muted hover:text-ink hover:underline">{T.shop}</Link>
        </p>
      </PortalFrame>
    )
  }

  return <>{children}</>
}
'@

Put "frontend\src\components\LegacyRedirects.tsx" @'
import { Navigate, useParams } from "react-router-dom"

// Anciennes adresses /mes-cours/:id -> nouvelle adresse de l'espace etudiant
export function LegacyCourseRedirect() {
  const { id } = useParams()
  return <Navigate to={`/etudiant/cours/${id ?? ""}`} replace />
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

const T = {
  brand: "Espace \u00e9tudiant",
  dashboard: "Tableau de bord",
  catalog: "Catalogue",
  shop: "Boutique",
  admin: "Administration",
  footer: "Espace \u00e9tudiant",
}

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
            UNIX <span className="text-sm font-semibold text-muted">{T.brand}</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && <span className="hidden max-w-[14rem] truncate text-xs text-muted sm:inline">{user.email}</span>}
            <button type="button" onClick={() => void handleLogout()} className="min-h-[44px] text-sm font-medium text-muted transition-colors hover:text-ink">
              {t("nav.logout")}
            </button>
            <PreferencesMenu />
          </div>
        </div>
        <nav aria-label={T.brand} className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3">
          <NavLink to="/etudiant" end className={tab}>{T.dashboard}</NavLink>
          <NavLink to="/etudiant/catalogue" className={tab}>{T.catalog}</NavLink>
          <span className="ml-auto flex items-center gap-1">
            {user?.is_admin && <Link to="/admin" className="px-3 text-sm font-medium text-muted hover:text-ink">{T.admin}</Link>}
            <Link to="/" className="px-3 text-sm font-medium text-muted hover:text-ink">{T.shop}</Link>
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
        &copy; {new Date().getFullYear()} UNIX &mdash; {T.footer}
      </footer>
    </div>
  )
}
'@

Write-Host "=== FRONTEND : routes et gardes ===" -ForegroundColor Cyan

$app = ".\frontend\src\App.tsx"

Patch $app 'import RequireStudent from "./components/RequireStudent"' (
  'import RequireStudentArea from "./components/RequireStudentArea"' + "`n" +
  'import StudentLayout from "./layouts/StudentLayout"' + "`n" +
  'import StudentLoginPage from "./pages/StudentLoginPage"' + "`n" +
  'import AdminLoginPage from "./pages/admin/AdminLoginPage"' + "`n" +
  'import { LegacyCourseRedirect } from "./components/LegacyRedirects"') "RequireStudentArea"

# Anciennes adresses : on redirige vers l'espace etudiant (les liens existants ne cassent pas)
PatchRx $app '<Route path="formations" element=\{<RequireAuth>[^\n]*' '<Route path="formations" element={<Navigate to="/etudiant/catalogue" replace />} />' 'Navigate to="/etudiant/catalogue"'
PatchRx $app '<Route path="mes-cours" element=\{<RequireAuth>[^\n]*' '<Route path="mes-cours" element={<Navigate to="/etudiant" replace />} />' 'Navigate to="/etudiant" replace'
PatchRx $app '<Route path="mes-cours/:id" element=\{<RequireAuth>[^\n]*' '<Route path="mes-cours/:id" element={<LegacyCourseRedirect />} />' 'LegacyCourseRedirect />'

$adminRoute = '<Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>'
$portalRoutes = @'
<Route path="etudiant/connexion" element={<StudentLoginPage />} />
        <Route path="etudiant" element={<RequireStudentArea><StudentLayout /></RequireStudentArea>}>
          <Route index element={<MyCoursesPage />} />
          <Route path="catalogue" element={<CoursesPage />} />
          <Route path="cours/:id" element={<CoursePlayerPage />} />
        </Route>

        <Route path="admin/connexion" element={<AdminLoginPage />} />
        
'@
Patch $app $adminRoute ($portalRoutes.TrimEnd() + "`n        " + $adminRoute) "StudentLoginPage />"

# Garde admin : renvoie vers la connexion ADMIN
Patch ".\frontend\src\components\RequireAdmin.tsx" 'to="/connexion"' 'to="/admin/connexion"' "/admin/connexion"

# Liens internes de l'espace etudiant
Patch ".\frontend\src\pages\MyCoursesPage.tsx" '/mes-cours/${' '/etudiant/cours/${' "/etudiant/cours/"
Patch ".\frontend\src\pages\MyCoursesPage.tsx" 'actionTo="/formations"' 'actionTo="/etudiant/catalogue"' "/etudiant/catalogue"
Patch ".\frontend\src\pages\CoursesPage.tsx" '/mes-cours/${' '/etudiant/cours/${' "/etudiant/cours/"
Patch ".\frontend\src\pages\CoursePlayerPage.tsx" '"/mes-cours"' '"/etudiant"' '"/etudiant"'
Patch ".\frontend\src\pages\AccountPage.tsx" 'to="/mes-cours"' 'to="/etudiant"' 'to="/etudiant"'

# Direct visible pour les etudiants (voir has_live cote serveur)
PatchRx ".\frontend\src\api\courses.ts" 'livekit_room\?: string \| null' ('livekit_room?: string | null' + "`n  " + 'has_live?: boolean') "has_live"
Patch ".\frontend\src\pages\CoursePlayerPage.tsx" '{enr.data?.course?.livekit_room && (' '{(enr.data?.course?.has_live || enr.data?.course?.livekit_room) && (' "has_live"

# Menu de la boutique : un seul lien discret vers l'espace etudiant (reserve aux etudiants)
Patch ".\frontend\src\lib\navLinks.ts" '{ to: "/formations", labelKey: "learn.nav_courses", access: "student" },' '' 'to: "/etudiant"'
Patch ".\frontend\src\lib\navLinks.ts" '{ to: "/mes-cours", labelKey: "learn.nav_my_courses", access: "student" },' '{ to: "/etudiant", labelKey: "learn.nav_my_courses", access: "student" },' 'to: "/etudiant"'

# Pied de page de la boutique : porte d'entree visible vers l'espace etudiant
Patch ".\frontend\src\components\Footer.tsx" 'import { useTranslation } from "react-i18next"' ('import { useTranslation } from "react-i18next"' + "`n" + 'import { Link } from "react-router-dom"') "react-router-dom"
$footAnchor = '<p>&copy; {new Date().getFullYear()} UNIX &mdash; {t("footer.shop")}</p>'
$footLink = '<Link to={canLearn ? "/etudiant" : "/etudiant/connexion"} className="text-xs font-semibold text-muted hover:text-ink hover:underline">{"Espace \u00e9tudiant"}</Link>'
Patch ".\frontend\src\components\Footer.tsx" $footAnchor ($footLink + "`n        " + $footAnchor) "/etudiant/connexion"

Write-Host "=== VERIFICATIONS ===" -ForegroundColor Cyan
Push-Location frontend
npx tsc -b
Pop-Location
php artisan test --filter="StudentPortalTest|AdminFormationsTest|StudentAccessTest|UserCoursesTest"

Write-Host ""
Write-Host "Adresses : /connexion (boutique)  /etudiant/connexion  /admin/connexion" -ForegroundColor Green
Write-Host "Termine. Collez-moi les lignes NON TROUVE / erreurs s'il y en a." -ForegroundColor Green