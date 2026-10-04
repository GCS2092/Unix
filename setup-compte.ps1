$ErrorActionPreference = "Stop"
if (-not (Test-Path .\artisan)) { Write-Host "Lancez ce script depuis C:\Unix (le dossier qui contient 'artisan')." -ForegroundColor Red; exit 1 }

$utf8 = New-Object System.Text.UTF8Encoding $false

function Patch($path, $old, $new, $marker = $null) {
  $p = (Resolve-Path $path).Path
  $c = [IO.File]::ReadAllText($p, $utf8)
  if ($marker -and $c.Contains($marker)) { Write-Host "DEJA FAIT : $path ($marker)"; return }
  if (-not $c.Contains($old)) { Write-Host "NON TROUVE : $path -> $old" -ForegroundColor Yellow; return }
  if (-not (Test-Path "$p.bak")) { Copy-Item $p "$p.bak" -Force }
  [IO.File]::WriteAllText($p, $c.Replace($old, $new), $utf8)
  Write-Host "OK : $path"
}

function Put($rel, $content) {
  $full = Join-Path (Get-Location) $rel
  $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [IO.File]::WriteAllText($full, $content, $utf8)
  Write-Host "CREE : $rel"
}

Write-Host "=== BACKEND ===" -ForegroundColor Cyan

Put "database\migrations\2026_10_04_110000_create_addresses_table.php" @'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 30)->nullable()->after('email');
        });

        Schema::create('addresses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 60)->nullable();
            $table->string('recipient_name', 120);
            $table->string('phone', 30);
            $table->string('city', 100);
            $table->string('district', 100)->nullable();
            $table->string('address', 255);
            $table->string('landmark', 255)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('phone');
        });
    }
};
'@

Put "app\Models\Address.php" @'
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Address extends Model
{
    protected $fillable = [
        'user_id', 'label', 'recipient_name', 'phone', 'city',
        'district', 'address', 'landmark', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }
}
'@

Put "app\Http\Controllers\Api\AddressController.php" @'
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'label' => ['nullable', 'string', 'max:60'],
            'recipient_name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:30'],
            'city' => ['required', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:255'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }

    private function owned(Request $request, Address $address): void
    {
        abort_unless($address->user_id === $request->user()->id, 404);
    }

    public function index(Request $request): JsonResponse
    {
        $rows = Address::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $uid = $request->user()->id;

        $isDefault = ! Address::query()->where('user_id', $uid)->exists()
            || (bool) ($data['is_default'] ?? false);

        if ($isDefault) {
            Address::query()->where('user_id', $uid)->update(['is_default' => false]);
        }

        $address = Address::query()->create(array_merge($data, [
            'user_id' => $uid,
            'is_default' => $isDefault,
        ]));

        return response()->json(['data' => $address], 201);
    }

    public function update(Request $request, Address $address): JsonResponse
    {
        $this->owned($request, $address);
        $data = $request->validate($this->rules());

        if ((bool) ($data['is_default'] ?? false)) {
            Address::query()->where('user_id', $address->user_id)->update(['is_default' => false]);
        } else {
            unset($data['is_default']);
        }

        $address->update($data);

        return response()->json(['data' => $address->fresh()]);
    }

    public function destroy(Request $request, Address $address): JsonResponse
    {
        $this->owned($request, $address);
        $wasDefault = $address->is_default;
        $uid = $address->user_id;
        $address->delete();

        if ($wasDefault) {
            Address::query()->where('user_id', $uid)->orderBy('id')->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'ok']);
    }
}
'@

Put "app\Http\Controllers\Api\ProfileController.php" @'
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user = $request->user();
        $user->update($data);

        return response()->json(['user' => UserResource::make($user->fresh())]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mot de passe actuel incorrect.'],
            ]);
        }

        $user->update(['password' => $data['password']]);

        $current = $user->currentAccessToken();
        if ($current instanceof PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $current->id)->delete();
        }

        return response()->json(['message' => 'ok']);
    }
}
'@

Patch ".\app\Models\User.php" 'protected $fillable = [' ('protected $fillable = [' + "`n        'phone',") "'phone',"
Patch ".\app\Http\Resources\UserResource.php" "'is_admin' => `$this->is_admin," ("'is_admin' => `$this->is_admin," + "`n            'phone' => `$this->phone,") "'phone' =>"

$routes = @'

        Route::patch('/profile', [\App\Http\Controllers\Api\ProfileController::class, 'update']);
        Route::put('/profile/password', [\App\Http\Controllers\Api\ProfileController::class, 'updatePassword']);
        Route::get('/addresses', [\App\Http\Controllers\Api\AddressController::class, 'index']);
        Route::post('/addresses', [\App\Http\Controllers\Api\AddressController::class, 'store']);
        Route::patch('/addresses/{address}', [\App\Http\Controllers\Api\AddressController::class, 'update']);
        Route::delete('/addresses/{address}', [\App\Http\Controllers\Api\AddressController::class, 'destroy']);
'@
$anchor = "        Route::get('/auth/me', [AuthController::class, 'me']);"
Patch ".\routes\api.php" $anchor ($anchor + $routes) "ProfileController"

Put "tests\Feature\AccountApiTest.php" @'
<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $over = []): array
    {
        return array_merge([
            'label' => 'Maison',
            'recipient_name' => 'Awa Diop',
            'phone' => '770000000',
            'city' => 'Dakar',
            'address' => 'Rue 10',
        ], $over);
    }

    public function test_first_address_becomes_default(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/addresses', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.is_default', true);
    }

    public function test_user_cannot_touch_another_users_address(): void
    {
        $other = User::factory()->create();
        $addr = Address::query()->create(array_merge($this->payload(), ['user_id' => $other->id]));

        Sanctum::actingAs(User::factory()->create());

        $this->patchJson('/api/v1/addresses/'.$addr->id, $this->payload())->assertNotFound();
        $this->deleteJson('/api/v1/addresses/'.$addr->id)->assertNotFound();
    }

    public function test_profile_and_password_update(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/profile', ['name' => 'Nouveau Nom', 'phone' => '771112233'])
            ->assertOk()
            ->assertJsonPath('user.phone', '771112233');

        $this->putJson('/api/v1/profile/password', [
            'current_password' => 'mauvais',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertStatus(422);

        $this->putJson('/api/v1/profile/password', [
            'current_password' => 'password',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertOk();
    }
}
'@

php -l .\routes\api.php
php artisan migrate --force
php artisan config:clear | Out-Null
Write-Host "--- routes ---"
php artisan route:list --path=api/v1 | Select-String "addresses|profile"

Write-Host "=== FRONTEND ===" -ForegroundColor Cyan

Put "frontend\src\api\account.ts" @'
import { apiClient } from "./client"

export interface Address {
  id: number
  label: string | null
  recipient_name: string
  phone: string
  city: string
  district: string | null
  address: string
  landmark: string | null
  is_default: boolean
}

export interface AddressInput {
  label: string
  recipient_name: string
  phone: string
  city: string
  district: string
  address: string
  landmark: string
  is_default: boolean
}

export const accountApi = {
  me: () => apiClient.get<{ user: { name: string; email: string; phone: string | null } }>("/auth/me"),
  updateProfile: (p: { name: string; phone: string }) =>
    apiClient.patch<{ user: { name: string; phone: string | null } }>("/profile", p),
  updatePassword: (p: { current_password: string; password: string; password_confirmation: string }) =>
    apiClient.put<{ message: string }>("/profile/password", p),
  addresses: () => apiClient.get<{ data: Address[] }>("/addresses"),
  createAddress: (p: AddressInput) => apiClient.post<{ data: Address }>("/addresses", p),
  updateAddress: (id: number, p: AddressInput) => apiClient.patch<{ data: Address }>(`/addresses/${id}`, p),
  deleteAddress: (id: number) => apiClient.delete(`/addresses/${id}`),
}
'@

Put "frontend\src\pages\AccountPage.tsx" @'
import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, type Address, type AddressInput } from "../api/account"
import { useAuthStore } from "../stores/authStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import { ErrorState, LoadingState } from "../components/States"
import Button from "../components/Button"

const T = {
  title: "Mon compte",
  quick: "Acc\u00e8s rapide",
  orders: "Mes commandes",
  courses: "Mes cours",
  profile: "Informations personnelles",
  fullName: "Nom complet",
  email: "E-mail",
  phone: "T\u00e9l\u00e9phone",
  save: "Enregistrer",
  saved: "Enregistr\u00e9",
  addresses: "Mes adresses de livraison",
  addressesHint: "Utilis\u00e9es pour pr\u00e9-remplir vos commandes. Vous pouvez aussi livrer \u00e0 une autre personne au moment de commander.",
  none: "Aucune adresse enregistr\u00e9e.",
  add: "Ajouter une adresse",
  edit: "Modifier",
  remove: "Supprimer",
  confirmRemove: "Supprimer cette adresse ?",
  label: "Nom de l'adresse (Maison, Bureau, Pour ma m\u00e8re...)",
  recipient: "Nom du destinataire",
  city: "Ville",
  district: "Quartier (facultatif)",
  address: "Adresse",
  landmark: "Point de rep\u00e8re (facultatif)",
  makeDefault: "Utiliser par d\u00e9faut",
  defaultTag: "Par d\u00e9faut",
  cancel: "Annuler",
  password: "Mot de passe",
  current: "Mot de passe actuel",
  newPwd: "Nouveau mot de passe (8 caract\u00e8res min.)",
  confirmPwd: "Confirmer le nouveau mot de passe",
  changePwd: "Changer le mot de passe",
  pwdChanged: "Mot de passe modifi\u00e9",
}

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

export default function AccountPage() {
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const canLearn = !!(authUser?.is_student || authUser?.is_admin)

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
      toast.success(T.saved)
      if (authUser) useAuthStore.setState({ user: { ...authUser, name: data.user.name } })
      void queryClient.invalidateQueries({ queryKey: ["account-me"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  // ---- Adresses ----
  const list = useQuery({ queryKey: ["addresses"], queryFn: async () => (await accountApi.addresses()).data.data })
  const [editing, setEditing] = useState<Address | "new" | null>(null)
  const [form, setForm] = useState<AddressInput>(emptyAddress)
  const setF = (k: keyof AddressInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  function openForm(a: Address | "new") {
    setEditing(a)
    setForm(
      a === "new"
        ? { ...emptyAddress, recipient_name: name, phone }
        : {
            label: a.label ?? "", recipient_name: a.recipient_name, phone: a.phone, city: a.city,
            district: a.district ?? "", address: a.address, landmark: a.landmark ?? "", is_default: a.is_default,
          },
    )
  }

  const saveAddress = useMutation({
    mutationFn: () =>
      editing && editing !== "new" ? accountApi.updateAddress(editing.id, form) : accountApi.createAddress(form),
    onSuccess: () => {
      toast.success(T.saved)
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ["addresses"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const removeAddress = useMutation({
    mutationFn: (id: number) => accountApi.deleteAddress(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  // ---- Mot de passe ----
  const [cur, setCur] = useState("")
  const [pwd, setPwd] = useState("")
  const [pwd2, setPwd2] = useState("")
  const changePwd = useMutation({
    mutationFn: () => accountApi.updatePassword({ current_password: cur, password: pwd, password_confirmation: pwd2 }),
    onSuccess: () => { toast.success(T.pwdChanged); setCur(""); setPwd(""); setPwd2("") },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (me.isLoading) return <LoadingState />
  if (me.error) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{T.title}</h1>

      <section className={`${card} space-y-2`}>
        <h2 className="text-lg font-semibold">{T.quick}</h2>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/commandes" className="min-h-[44px] rounded-lg border border-line px-4 py-3 text-primary hover:bg-primary/5">{T.orders}</Link>
          {canLearn && (
            <Link to="/mes-cours" className="min-h-[44px] rounded-lg border border-line px-4 py-3 text-primary hover:bg-primary/5">{T.courses}</Link>
          )}
        </div>
      </section>

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); saveProfile.mutate() }} className={`${card} space-y-4`}>
        <h2 className="text-lg font-semibold">{T.profile}</h2>
        <Field label={T.fullName} value={name} onChange={setName} required auto="name" />
        <Field label={T.email} value={me.data?.email ?? ""} onChange={() => undefined} disabled />
        <Field label={T.phone} value={phone} onChange={setPhone} type="tel" auto="tel" />
        <Button type="submit" size="lg" loading={saveProfile.isPending}>{T.save}</Button>
      </form>

      <section className={`${card} space-y-4`}>
        <div>
          <h2 className="text-lg font-semibold">{T.addresses}</h2>
          <p className="text-sm text-muted">{T.addressesHint}</p>
        </div>

        {list.isLoading && <LoadingState />}
        {list.data && list.data.length === 0 && editing === null && <p className="text-sm text-muted">{T.none}</p>}

        {list.data && list.data.map((a) => (
          <div key={a.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {a.label || a.recipient_name}
                  {a.is_default && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{T.defaultTag}</span>}
                </p>
                <p className="text-muted">{a.recipient_name} &middot; {a.phone}</p>
                <p className="text-muted">{[a.address, a.landmark, a.district, a.city].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button type="button" onClick={() => openForm(a)} className="min-h-[44px] font-semibold text-primary hover:underline">{T.edit}</button>
                <button
                  type="button"
                  onClick={() => { if (window.confirm(T.confirmRemove)) removeAddress.mutate(a.id) }}
                  className="min-h-[44px] font-semibold text-danger hover:underline"
                >
                  {T.remove}
                </button>
              </div>
            </div>
          </div>
        ))}

        {editing !== null ? (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); saveAddress.mutate() }} className="space-y-3 rounded-lg bg-page p-3">
            <Field label={T.label} value={form.label} onChange={(v) => setF("label", v)} />
            <Field label={T.recipient} value={form.recipient_name} onChange={(v) => setF("recipient_name", v)} required auto="name" />
            <Field label={T.phone} value={form.phone} onChange={(v) => setF("phone", v)} type="tel" required auto="tel" />
            <Field label={T.city} value={form.city} onChange={(v) => setF("city", v)} required auto="address-level2" />
            <Field label={T.district} value={form.district} onChange={(v) => setF("district", v)} />
            <Field label={T.address} value={form.address} onChange={(v) => setF("address", v)} required auto="street-address" />
            <Field label={T.landmark} value={form.landmark} onChange={(v) => setF("landmark", v)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setF("is_default", e.target.checked)} />
              {T.makeDefault}
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="min-h-[44px] rounded-lg border border-line px-4 font-semibold">{T.cancel}</button>
              <Button type="submit" size="lg" className="flex-1" loading={saveAddress.isPending}>{T.save}</Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => openForm("new")} className="min-h-[44px] w-full rounded-lg border border-dashed border-primary px-4 font-semibold text-primary hover:bg-primary/5">
            + {T.add}
          </button>
        )}
      </section>

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); changePwd.mutate() }} className={`${card} space-y-4`}>
        <h2 className="text-lg font-semibold">{T.password}</h2>
        <Field label={T.current} value={cur} onChange={setCur} type="password" required auto="current-password" />
        <Field label={T.newPwd} value={pwd} onChange={setPwd} type="password" required auto="new-password" />
        <Field label={T.confirmPwd} value={pwd2} onChange={setPwd2} type="password" required auto="new-password" />
        <Button type="submit" size="lg" loading={changePwd.isPending}>{T.changePwd}</Button>
      </form>
    </div>
  )
}
'@

# Route /compte
$app = ".\frontend\src\App.tsx"
Patch $app 'const CoursesPage = lazy(() => import("./pages/CoursesPage"))' ('const CoursesPage = lazy(() => import("./pages/CoursesPage"))' + "`n" + 'const AccountPage = lazy(() => import("./pages/AccountPage"))') "AccountPage"
$ord = '<Route path="commandes" element={<RequireAuth><OrdersPage /></RequireAuth>} />'
Patch $app $ord ($ord + "`n          " + '<Route path="compte" element={<RequireAuth><AccountPage /></RequireAuth>} />') 'path="compte"'

# Liens "Mon compte" : barre du haut (ordinateur)
Patch ".\frontend\src\components\Navbar.tsx" '{user.is_admin && <NavLink to="/admin" className={desktopLink}>{t("nav.admin")}</NavLink>}' ('<NavLink to="/compte" className={desktopLink}>Mon compte</NavLink>' + "`n              " + '{user.is_admin && <NavLink to="/admin" className={desktopLink}>{t("nav.admin")}</NavLink>}') 'to="/compte"'

# Menu "Compte" du telephone
$bnAnchor = '{user && <p className="truncate px-3 py-2 text-sm text-muted">{user.email}</p>}'
$bnLink = @'

            {user && (
              <NavLink to="/compte" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-page active:bg-line/60">
                Mon compte
              </NavLink>
            )}
'@
Patch ".\frontend\src\components\BottomNav.tsx" $bnAnchor ($bnAnchor + $bnLink) 'to="/compte"'

# Paiement : adresses enregistrees
$co = ".\frontend\src\pages\CheckoutPage.tsx"
Patch $co 'import { loadContact, saveContact } from "../lib/savedContact"' ('import { loadContact, saveContact } from "../lib/savedContact"' + "`n" + 'import { accountApi, type Address } from "../api/account"') "api/account"

$state = @'

  const [saveAddr, setSaveAddr] = useState(false)
  const [addrId, setAddrId] = useState("")
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await accountApi.addresses()).data.data,
    enabled: !!user,
  })
  function applyAddress(a: Address) {
    setAddrId(String(a.id))
    setName(a.recipient_name)
    setPhone(a.phone)
    setMethod("delivery")
    setCity(a.city)
    setDistrict(a.district ?? "")
    setAddress(a.address)
    setLandmark(a.landmark ?? "")
  }
  function clearAddress() {
    setAddrId("")
    setName(user?.name ?? "")
    setPhone("")
    setCity("")
    setDistrict("")
    setAddress("")
    setLandmark("")
  }
  useEffect(() => {
    if (addresses && addrId === "" && !saved.address) {
      const d = addresses.find((x) => x.is_default)
      if (d) applyAddress(d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses])
'@
Patch $co 'const [accepted, setAccepted] = useState(false)' ('const [accepted, setAccepted] = useState(false)' + $state) "const [saveAddr"

$sel = @'
{user && addresses && addresses.length > 0 && (
              <label className="block text-sm font-medium">
                {"Livrer \u00e0"}
                <select
                  value={addrId}
                  onChange={(e) => {
                    const a = addresses.find((x) => String(x.id) === e.target.value)
                    if (a) applyAddress(a)
                    else clearAddress()
                  }}
                  className={inputClass}
                >
                  <option value="">{"Autre personne / autre adresse"}</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>{(a.label || a.recipient_name) + " \u2013 " + a.city}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  {"Vous pouvez modifier les champs ci-dessous pour cette commande."}
                </span>
              </label>
            )}
            {!user && (
'@
Patch $co '{!user && (' $sel.TrimEnd() "Autre personne / autre adresse"

$chk = @'
{user && delivery && !addrId && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="mt-1" />
                <span>{"Enregistrer cette adresse dans mon compte"}</span>
              </label>
            )}
            <label className="flex items-start gap-2 text-sm">
'@
Patch $co '<label className="flex items-start gap-2 text-sm">' $chk.TrimEnd() "Enregistrer cette adresse"

$save = @'
saveContact({ name, phone, city, district, address, landmark })
      if (user && delivery && saveAddr && !addrId) {
        await accountApi
          .createAddress({ label: city, recipient_name: name || user.name, phone, city, district, address, landmark, is_default: false })
          .catch(() => undefined)
      }
'@
Patch $co 'saveContact({ name, phone, city, district, address, landmark })' $save.TrimEnd() ".createAddress("

Write-Host "=== VERIFICATIONS ===" -ForegroundColor Cyan
Push-Location frontend
npx tsc -b
Pop-Location
php artisan test --filter="AccountApiTest|StudentAccessTest"
Write-Host "Termine. Collez-moi les lignes NON TROUVE / erreurs s'il y en a." -ForegroundColor Green