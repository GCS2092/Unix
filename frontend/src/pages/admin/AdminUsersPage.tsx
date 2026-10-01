import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminUser } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { useAuthStore } from "../../stores/authStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"

type Patch = { is_admin?: boolean; is_blocked?: boolean }

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

  function handleRole(u: AdminUser) {
    const msg = u.is_admin
      ? t("admin.confirm_demote", { defaultValue: "Retirer le rôle administrateur à {{name}} ?", name: u.name })
      : t("admin.confirm_promote", { defaultValue: "Donner le rôle administrateur à {{name}} ?", name: u.name })
    if (window.confirm(msg)) update.mutate({ u, patch: { is_admin: !u.is_admin } })
  }

  function handleBlock(u: AdminUser) {
    const msg = u.is_blocked
      ? t("admin.confirm_unblock", { defaultValue: "Débloquer le compte de {{name}} ?", name: u.name })
      : t("admin.confirm_block", { defaultValue: "Bloquer le compte de {{name}} ? Il sera déconnecté et ne pourra plus se connecter.", name: u.name })
    if (window.confirm(msg)) update.mutate({ u, patch: { is_blocked: !u.is_blocked } })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {t("admin.users", { defaultValue: "Utilisateurs" })} {data && <span className="text-muted">({data.meta.total})</span>}
        </h2>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("admin.search_users", { defaultValue: "Rechercher un nom ou un e-mail" })}
          className="min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary sm:w-72"
        />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.data.length === 0 && <EmptyState message={t("admin.no_users", { defaultValue: "Aucun utilisateur." })} />}
      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
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
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-muted">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.is_admin ? "bg-primary/10 text-primary" : "bg-page text-muted"}`}>
                        {u.is_admin ? "Admin" : t("admin.customer", { defaultValue: "Client" })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.is_blocked ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                        {u.is_blocked ? t("admin.blocked", { defaultValue: "Bloqué" }) : t("admin.active", { defaultValue: "Actif" })}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.orders_count ?? 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString(locale)}</td>
                    <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRole(u)}
                        disabled={update.isPending || self}
                        className="font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {u.is_admin ? t("admin.demote", { defaultValue: "Retirer admin" }) : t("admin.promote", { defaultValue: "Passer admin" })}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBlock(u)}
                        disabled={update.isPending || self || (u.is_admin && !u.is_blocked)}
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