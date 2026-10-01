import { create } from "zustand"

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Action destructive : bouton rouge, focus sur « Annuler » */
  danger?: boolean
  /** Si défini, affiche un champ de motif (facultatif) */
  reasonLabel?: string
}

export interface ConfirmResult {
  ok: boolean
  reason: string
}

interface ConfirmState {
  current: (ConfirmOptions & { id: number }) | null
  resolver: ((r: ConfirmResult) => void) | null
  ask: (options: ConfirmOptions) => Promise<ConfirmResult>
  close: (ok: boolean, reason: string) => void
}

let nextId = 1

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  resolver: null,
  ask: (options) =>
    new Promise<ConfirmResult>((resolve) => {
      get().resolver?.({ ok: false, reason: "" }) // une seule boîte à la fois
      set({ current: { ...options, id: nextId++ }, resolver: resolve })
    }),
  close: (ok, reason) => {
    const resolver = get().resolver
    set({ current: null, resolver: null })
    resolver?.({ ok, reason })
  },
}))

/** Usage : const { ok, reason } = await confirmAction({ title: "Supprimer ?", danger: true }) */
export function confirmAction(options: ConfirmOptions): Promise<ConfirmResult> {
  return useConfirmStore.getState().ask(options)
}