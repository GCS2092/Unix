import { useEffect, useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { usersAdminApi } from "../../api/usersAdmin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"

/** Suppression d'un compte : l'admin doit retaper l'e-mail pour confirmer. */
export default function DeleteUserModal({ user, onClose, onDeleted }: {
  user: { id: number; name: string; email: string; orders_count?: number; enrollments_count?: number }
  onClose: () => void
  onDeleted: () => void
}) {
  const { i18n } = useTranslation()
  const fr = !i18n.language.startsWith("en")
  const L = (a: string, b: string) => (fr ? a : b)
  const [typed, setTyped] = useState("")
  const hasData = (user.orders_count ?? 0) > 0 || (user.enrollments_count ?? 0) > 0
  const match = typed.trim().toLowerCase() === user.email.toLowerCase()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const del = useMutation({
    mutationFn: () => usersAdminApi.deleteUser(user.id, typed.trim()),
    onSuccess: () => { toast.success(L("Compte supprimé.", "Account deleted.")); onDeleted(); onClose() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (match) del.mutate() }}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 shadow-card-lg sm:rounded-2xl">
        <h2 className="text-lg font-bold text-danger">{L("Supprimer ce compte ?", "Delete this account?")}</h2>
        <p className="text-sm">
          <span className="font-semibold">{user.name}</span><br />
          <span className="break-all text-muted">{user.email}</span>
        </p>
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {hasData
            ? L("Ce compte a un historique (commandes ou inscriptions). Ses données personnelles seront effacées et le compte anonymisé ; les commandes et certificats sont conservés. Action irréversible.",
                "This account has history (orders or enrollments). Personal data will be erased and the account anonymized; orders and certificates are kept. This cannot be undone.")
            : L("Ce compte est vide : il sera supprimé définitivement. Action irréversible.",
                "This account is empty: it will be permanently deleted. This cannot be undone.")}
        </p>
        <label className="block text-sm font-medium">
          {L("Pour confirmer, tapez l'e-mail du compte :", "To confirm, type the account email:")}
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus
            className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-danger focus:ring-2 focus:ring-danger/20" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-line bg-surface px-4 text-sm font-semibold transition hover:bg-black/5">{L("Annuler", "Cancel")}</button>
          <button type="submit" disabled={!match || del.isPending} className="min-h-[44px] rounded-lg bg-danger px-4 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-40">
            {del.isPending ? L("Suppression…", "Deleting…") : L("Supprimer définitivement", "Delete permanently")}
          </button>
        </div>
      </form>
    </div>
  )
}