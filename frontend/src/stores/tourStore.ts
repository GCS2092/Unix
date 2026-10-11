import { create } from "zustand"

interface TourState {
  /** true pendant qu'une visite guidee est affichee */
  active: boolean
  /** compteur : chaque appel a restart() demande une relance manuelle */
  manual: number
  setActive: (v: boolean) => void
  restart: () => void
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  manual: 0,
  setActive: (active) => set({ active }),
  restart: () => set((s) => ({ manual: s.manual + 1 })),
}))