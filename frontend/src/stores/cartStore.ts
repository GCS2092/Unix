import { create } from "zustand"
import { cartApi } from "../api/cart"
import type { Cart, CartItemType } from "../types"

interface CartState {
  cart: Cart
  loading: boolean
  loaded: boolean
  error: unknown
  fetch: () => Promise<void>
  add: (type: CartItemType, id: number, quantity?: number) => Promise<void>
  update: (type: CartItemType, id: number, quantity: number) => Promise<void>
  remove: (type: CartItemType, id: number) => Promise<void>
}

const emptyCart: Cart = { items: [], total: 0 }

const totalOf = (items: Cart["items"]) => items.reduce((n, i) => n + i.line_total, 0)

export const useCartStore = create<CartState>((set, get) => ({
  cart: emptyCart,
  loading: false,
  loaded: false,
  error: null,

  fetch: async () => {
    set({ loading: true })
    try {
      const { data } = await cartApi.show()
      set({ cart: data.data, error: null })
    } catch (e) {
      set({ error: e })
      throw e
    } finally {
      set({ loading: false, loaded: true })
    }
  },

  add: async (type, id, quantity) => {
    const { data } = await cartApi.add({ type, id, quantity })
    set({ cart: data.data, error: null })
  },

  // Mise à jour optimiste : l'interface réagit tout de suite, retour arrière si le serveur refuse
  update: async (type, id, quantity) => {
    const previous = get().cart
    const items = previous.items.map((i) =>
      i.type === type && i.id === id ? { ...i, quantity, line_total: i.unit_price * quantity } : i,
    )
    set({ cart: { items, total: totalOf(items) } })
    try {
      const { data } = await cartApi.update(type, id, { quantity })
      set({ cart: data.data })
    } catch (e) {
      set({ cart: previous })
      throw e
    }
  },

  remove: async (type, id) => {
    const previous = get().cart
    const items = previous.items.filter((i) => !(i.type === type && i.id === id))
    set({ cart: { items, total: totalOf(items) } })
    try {
      const { data } = await cartApi.remove(type, id)
      set({ cart: data.data })
    } catch (e) {
      set({ cart: previous })
      throw e
    }
  },
}))