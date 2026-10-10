import { create } from "zustand"

interface DrawerState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useDrawerStore = create<DrawerState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))