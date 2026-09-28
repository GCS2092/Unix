import { create } from "zustand"
import { authApi } from "../api/auth"
import { TOKEN_KEY } from "../api/client"
import type { User } from "../types"

interface AuthState {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      set({ loading: false })
      return
    }
    try {
      const { data } = await authApi.me()
      set({ user: data.user, loading: false })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({ user: null, loading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    set({ user: data.user })
  },

  register: async (name, email, password, passwordConfirmation) => {
    const { data } = await authApi.register({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    set({ user: data.user })
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      set({ user: null })
    }
  },
}))

window.addEventListener("auth:expired", () => {
  useAuthStore.setState({ user: null })
})
