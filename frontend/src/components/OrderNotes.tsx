import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { shopApi, type TimelineEntry } from "../api/shop"
import { useAuthStore } from "../stores/authStore"
import { adminScopeOf } from "../lib/adminPaths"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import Button from "./Button"

const ACTIONS: Record<string, [string, string]> = {
  "order.created_manually": ["Commande créée par l'équipe", "Created by staff"],
  "order.marked_paid_manually": ["Marquée payée manuellement", "Marked as paid manually"],
  "order.cancelled": ["Commande annulée", "Order cancelled"],
  "order.fulfillment_updated": ["Étape de livraison modifiée", "Delivery step changed"],
  "order.tracking_updated": ["Suivi mis à jour", "Tracking updated"],
  "order.confirmation_resent": ["E-mail de confirmation renvoyé", "Confirmation email resent"],
  "order.stock_conflict_resolved": ["Conflit de stock traité", "Stock conflict resolved"],
  "order.stock_conflict_detected": ["Conflit de stock détecté", "Stock conflict detected"],
}

export default function OrderNotes({ orderId }: { orderId: number }) {
  const { t, i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const L = (a: string, b: string) => (fr ? a : b)
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isSuper = adminScopeOf(user) === "super"
  const [body, setBody] = useState("")
  const key = ["admin-order-timeline", orderId]

  const q = useQuery({ queryKey: key, queryFn: async () => (await shopApi.timeline(orderId)).data.data, staleTime: 0 })
  const add = useMutation({
    mutationFn: () => shopApi.addOrderNote(orderId, body.trim()),
    onSuccess: () => { setBody(""); void qc.invalidateQueries({ queryKey: key }) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const del = useMutation({
    mutationFn: (noteId: number) => shopApi.deleteOrderNote(orderId, noteId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(fr ? "fr-FR" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

  const label = (e: TimelineEntry) => {
    if (e.type === "created") return L("Commande créée", "Order created")
    if (e.type === "step") return t(`fulfillment.${e.label}`, { defaultValue: e.label })
    if (e.type === "action") return ACTIONS[e.label] ? ACTIONS[e.label][fr ? 0 : 1] : e.label
    return e.label
  }

  return (
    <section data-tour="od-notes" className="mt-5 rounded-lg border border-line bg-surface p-3 sm:p-4">
      <h3 className="text-sm font-semibold">{L("Notes internes et historique", "Internal notes and history")}</h3>
      <p className="text-xs text-muted">{L("Visible uniquement par l'équipe.", "Visible to the team only.")}</p>

      <form
        onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate() }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <textarea
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={L("Ajouter une note (ex. client rappelé, livraison jeudi)", "Add a note (e.g. customer called, delivery Thursday)")}
          className="min-h-[44px] w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()} className="sm:self-start">
          {L("Ajouter", "Add")}
        </Button>
      </form>

      {q.isLoading && <p className="mt-3 text-sm text-muted">{t("states.loading")}</p>}
      {q.error && <p role="alert" className="mt-3 text-sm text-danger">{getErrorMessage(q.error)}</p>}

      <ol className="mt-3 space-y-2">
        {(q.data ?? []).map((e, i) => (
          <li key={`${e.type}-${e.id ?? i}-${e.at}`} className={`rounded-lg px-3 py-2 text-sm ${e.type === "note" ? "bg-accent/10" : "bg-page"}`}>
            <div className="flex items-start justify-between gap-3">
              <p className={`min-w-0 whitespace-pre-line break-words ${e.type === "note" ? "" : "text-muted"}`}>
                {e.type === "note" && <span className="mr-1 font-semibold">{L("Note", "Note")} :</span>}
                {label(e)}
              </p>
              {e.type === "note" && e.id !== undefined && (isSuper || e.user_id === user?.id) && (
                <button
                  type="button"
                  onClick={() => del.mutate(e.id as number)}
                  className="shrink-0 text-xs font-semibold text-danger hover:underline"
                >
                  {L("Supprimer", "Delete")}
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">{[e.author, when(e.at)].filter(Boolean).join(" · ")}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}