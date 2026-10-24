import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminUser } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { useAuthStore } from "../../stores/authStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { Pill, Svg } from "../../components/admin/ui"
import { Avatar, Hero, SearchBox, Segmented } from "../../components/admin/formationUi"

type Patch = { is_admin?: boolean; admin_scope?: string; is_blocked?: boolean; is_student?: boolean }
type Filter = "" | "admin" | "instructor" | "client" | "student" | "blocked"

const SCOPES: { value: string; label: string }[] = [
  { value: "super", label: "Super admin" },
  { value: "shop", label: "Boutique" },
  { value: "formation", label: "Formation" },
  { value: "instructor", label: "Formateur" },
]

const DOTS = "M5 12h.01M12 12h.01M19 12h.01"

const matches = (u: AdminUser, f: Filter) =>
  f === "" ? true
  : f === "admin" ? u.is_admin
  : f === "instructor" ? u.is_admin && u.admin_scope === "instructor"
  : f === "client" ? !u.is_admin
  : f === "student" ? Boolean(u.is_student)
  : Boolean(u.is_blocked)

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative" onClick={(e) => { if ((e.target as HTMLElement).closest("button")) e.currentTarget.removeAttribute("open") }}>
      <summary
        aria-label="Plus d'actions" title="Plus d'actions"
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary/40 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <Svg d={DOTS} className="h-5 w-5" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-56 rounded-xl border border-line bg-surface p-1 shadow-card-lg">{children}</div>
    </details>
  )
}

const item = "flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm font-semibold transition hover:bg-black/5 disabled:opacity-40"

export default function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users", page, q],
    queryFn: async () => (await adminApi.users(page, q)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const update = useMutation({
    mutationFn: ({ u, patch }: { u: AdminUser; patch: Patch }) => adminApi.updateUser(u.id, patch),
    onSuccess: async () => {
      toast.success(t("admin.saved", { defaultValue: "Enregistré" }))
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const scopeLabel = (v: string) => SCOPES.find((s) => s.value === v)?.label ?? v

  function changeScope(u: AdminUser, scope: string) {
    if (!scope) return
    const msg = u.is_admin
      ? `Changer l'espace de ${u.name} : ${scopeLabel(scope)} ?`
      : `Donner le rôle « ${scopeLabel(scope)} » à ${u.name} ?`
    if (window.confirm(msg)) update.mutate({ u, patch: u.is_admin ? { admin_scope: scope } : { is_admin: true, admin_scope: scope } })
  }

  function handleDemote(u: AdminUser) {
    if (window.confirm(t("admin.confirm_demote", { defaultValue: "Retirer le rôle administrateur à {{name}} ?", name: u.name })))
      update.mutate({ u, patch: { is_admin: false } })
  }

  function handleStudent(u: AdminUser) {
    const msg = u.is_student ? `Retirer l'accès aux formations à ${u.name} ?` : `Donner l'accès aux formations à ${u.name} ?`
    if (window.confirm(msg)) update.mutate({ u, patch: { is_student: !u.is_student } })
  }

  function handleBlock(u: AdminUser) {
    const msg = u.is_blocked
      ? t("admin.confirm_unblock", { defaultValue: "Débloquer le compte de {{name}} ?", name: u.name })
      : t("admin.confirm_block", { defaultValue: "Bloquer le compte de {{name}} ? Il sera déconnecté et ne pourra plus se connecter.", name: u.name })
    if (window.confirm(msg)) update.mutate({ u, patch: { is_blocked: !u.is_blocked } })
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      toast.success("E-mail copié.")
    } catch {
      toast.error("Copie impossible.")
    }
  }

  const all = data?.data ?? []
  const rows = all.filter((u) => matches(u, filter))
  const count = (f: Filter) => all.filter((u) => matches(u, f)).length
  const date = (d: string) => new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })

  const roleSelect = (u: AdminUser, busy: boolean) => (
    <select
      aria-label={`Rôle de ${u.name}`} disabled={busy}
      value={u.is_admin ? (u.admin_scope ?? "super") : ""}
      onChange={(e) => changeScope(u, e.target.value)}
      className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-2 text-sm font-medium disabled:opacity-50 sm:w-auto"
    >
      {!u.is_admin && <option value="">{t("admin.customer", { defaultValue: "Client" })}</option>}
      {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )

  const badges = (u: AdminUser, self: boolean) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {self && <Pill tone="info">Vous</Pill>}
      {u.is_admin && <Pill tone="warn">{scopeLabel(u.admin_scope ?? "super")}</Pill>}
      {u.is_student && <Pill tone="info">{t("px.fm.student", { defaultValue: "Étudiant" })}</Pill>}
      <Pill tone={u.is_blocked ? "danger" : "success"} dot>
        {u.is_blocked ? t("admin.blocked", { defaultValue: "Bloqué" }) : t("admin.active", { defaultValue: "Actif" })}
      </Pill>
    </span>
  )

  const actions = (u: AdminUser, busy: boolean) => (
    <Menu>
      {u.is_admin && <button type="button" disabled={busy} onClick={() => handleDemote(u)} className={item}>{t("admin.demote", { defaultValue: "Retirer admin" })}</button>}
      <button type="button" disabled={busy} onClick={() => handleStudent(u)} className={item}>{u.is_student ? "Retirer étudiant" : "Passer étudiant"}</button>
      <button type="button" disabled={busy} onClick={() => void copyEmail(u.email)} className={item}>Copier l'e-mail</button>
      <button
        type="button" disabled={busy || (u.is_admin && !u.is_blocked)} onClick={() => handleBlock(u)}
        className={`${item} ${u.is_blocked ? "text-primary" : "text-danger"}`}
      >
        {u.is_blocked ? t("admin.unblock", { defaultValue: "Débloquer" }) : t("admin.block", { defaultValue: "Bloquer" })}
      </button>
    </Menu>
  )

  return (
    <div className="space-y-5">
      <Hero
        title={t("admin.users", { defaultValue: "Utilisateurs" })}
        count={data?.meta.total}
        subtitle="Gérez les rôles, l'accès aux formations et le blocage des comptes."
      />

      <div className="space-y-3">
        <SearchBox value={input} onChange={setInput} tour="us-search" placeholder={t("admin.search_users", { defaultValue: "Rechercher un nom ou un e-mail" })} />
        <Segmented
          value={filter} onChange={setFilter}
          items={[
            { id: "", label: "Tous" },
            { id: "admin", label: `Admins (${count("admin")})` },
            { id: "instructor", label: `Formateurs (${count("instructor")})` },
            { id: "client", label: `Clients (${count("client")})` },
            { id: "student", label: `Étudiants (${count("student")})` },
            { id: "blocked", label: `Bloqués (${count("blocked")})` },
          ]}
        />
        {filter !== "" && <p className="text-xs text-muted">Filtre appliqué à la page affichée ({all.length} comptes).</p>}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && all.length === 0 && <EmptyState message={t("admin.no_users", { defaultValue: "Aucun utilisateur." })} />}
      {data && all.length > 0 && rows.length === 0 && <EmptyState message="Aucun compte de cette page ne correspond au filtre." />}

      {rows.length > 0 && (
        <>
          <ul data-tour="us-table" className="grid gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((u) => {
              const self = u.id === me?.id
              const busy = update.isPending || self
              return (
                <li key={u.id} className="min-w-0 rounded-card border border-line bg-surface p-3.5 shadow-card">
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                      <div className="mt-2">{badges(u, self)}</div>
                    </div>
                    {actions(u, busy)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-page p-2.5 text-center text-xs">
                    <div><p className="text-muted">{t("admin.orders")}</p><p className="mt-0.5 text-base font-bold">{u.orders_count ?? 0}</p></div>
                    <div><p className="text-muted">Inscrit le</p><p className="mt-0.5 text-sm font-bold">{date(u.created_at)}</p></div>
                  </div>
                  <div className="mt-3">{roleSelect(u, busy)}</div>
                </li>
              )
            })}
          </ul>

          <div data-tour="us-table" className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Utilisateur</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.role", { defaultValue: "Rôle" })}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.col_status")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("admin.orders")}</th>
                  <th className="px-4 py-3 font-semibold">Inscrit le</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((u) => {
                  const self = u.id === me?.id
                  const busy = update.isPending || self
                  return (
                    <tr key={u.id} className="transition hover:bg-page/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <p className="font-semibold">{u.name}</p>
                            <p className="text-xs text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{roleSelect(u, busy)}</td>
                      <td className="px-4 py-3">{badges(u, self)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{u.orders_count ?? 0}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{date(u.created_at)}</td>
                      <td className="px-4 py-3"><div className="flex justify-end">{actions(u, busy)}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}

