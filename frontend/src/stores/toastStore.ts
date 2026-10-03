import { create } from "zustand"

export type ToastKind = "success" | "error" | "info"
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    if (get().toasts.some((t) => t.message === message)) return
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, message }] }))
    setTimeout(() => get().dismiss(id), kind === "error" ? 6500 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  info: (m: string) => useToastStore.getState().push("info", m),
}