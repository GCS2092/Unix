import { create } from "zustand"

export interface RecentProduct {
  id: number
  slug: string
  name: string
  price: number
  image: string | null
  in_stock?: boolean
}

const KEY = "recent_products"
const MAX = 8

function load(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return (list as RecentProduct[]).filter((x) => x && typeof x.slug === "string").slice(0, MAX)
  } catch {
    return []
  }
}

function save(items: RecentProduct[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // stockage indisponible (navigation privee, quota) : on ignore
  }
}

interface RecentState {
  items: RecentProduct[]
  push: (p: RecentProduct) => void
  clear: () => void
}

// Memoire locale a l'appareil : rien n'est envoye au serveur
export const useRecentStore = create<RecentState>((set, get) => ({
  items: load(),
  push: (p) => {
    const items = [p, ...get().items.filter((x) => x.id !== p.id)].slice(0, MAX)
    save(items)
    set({ items })
  },
  clear: () => {
    save([])
    set({ items: [] })
  },
}))