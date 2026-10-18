import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminUser } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { useAuthStore } from "../../stores/authStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { Badge, PageHeader, field } from "../../components/admin/PageHeader"

type Patch = { is_admin?: boolean; admin_scope?: string; is_blocked?: boolean; is_student?: boolean }

const SCOPES: { value: string; label: string }[] = [
  { value: "super", label: "Super admin" },
  { value: "shop", label: "Boutique" },
  { value: "formation", label: "Formation" },
  { value: "instructor", label: "Formateur" },
]

export default function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")

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
    const msg = u.is_student
      ? `Retirer l'accès aux formations à ${u.name} ?`
      : `Donner l'accès aux formations à ${u.name} ?`
    if (window.confirm(msg)) update.mutate({ u, patch: { is_student: !u.is_student } })
  }

  function handleBlock(u: AdminUser) {
    const msg = u.is_blocked
      ? t("admin.confirm_unblock", { defaultValue: "Débloquer le compte de {{name}} ?", name: u.name })
      : t("admin.confirm_block", { defaultValue: "Bloquer le compte de {{name}} ? Il sera déconnecté et ne pourra plus se connecter.", name: u.name })
    if (window.confirm(msg)) update.mutate({ u, patch: { is_blocked: !u.is_blocked } })
  }

  return (
    <div>
      <PageHeader
        title={t("admin.users", { defaultValue: "Utilisateurs" })}
        count={data?.meta.total}
        action={
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            data-tour="us-search"
            placeholder={t("admin.search_users", { defaultValue: "Rechercher un nom ou un e-mail" })}
            className={`${field} !mt-0 sm:w-72`}
          />
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_users", { defaultValue: "Aucun utilisateur." })} />}
      {data && data.data.length > 0 && (
        <div data-tour="us-table" className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.col_customer")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.role", { defaultValue: "Rôle" })}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_status")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.orders")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.col_date")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("admin.col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((u) => {
                const self = u.id === me?.id
                const busy = update.isPending || self
                return (
                  <tr key={u.id} className="transition hover:bg-page/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-muted">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Rôle de ${u.name}`}
                          disabled={busy}
                          value={u.is_admin ? (u.admin_scope ?? "super") : ""}
                          onChange={(e) => changeScope(u, e.target.value)}
                          className="min-h-[40px] rounded-lg border border-line bg-surface px-2 text-sm disabled:opacity-50"
                        >
                          {!u.is_admin && <option value="">{t("admin.customer", { defaultValue: "Client" })}</option>}
                          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {u.is_student && <Badge tone="primary">{t("px.fm.student", { defaultValue: "Étudiant" })}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.is_blocked ? "danger" : "success"}>
                        {u.is_blocked ? t("admin.blocked", { defaultValue: "Bloqué" }) : t("admin.active", { defaultValue: "Actif" })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{u.orders_count ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(u.created_at).toLocaleDateString(locale)}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                      {u.is_admin && (
                        <button type="button" onClick={() => handleDemote(u)} disabled={busy} className="font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline">
                          {t("admin.demote", { defaultValue: "Retirer admin" })}
                        </button>
                      )}
                      <button type="button" onClick={() => handleStudent(u)} disabled={busy} className="font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline">
                        {u.is_student ? "Retirer étudiant" : "Passer étudiant"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBlock(u)}
                        disabled={busy || (u.is_admin && !u.is_blocked)}
                        className={`font-semibold hover:underline disabled:opacity-40 disabled:no-underline ${u.is_blocked ? "text-primary" : "text-danger"}`}
                      >
                        {u.is_blocked ? t("admin.unblock", { defaultValue: "Débloquer" }) : t("admin.block", { defaultValue: "Bloquer" })}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}
