import { create } from "zustand"
import { isAxiosError } from "axios"
import i18n from "../i18n"
import { authApi } from "../api/auth"
import { TOKEN_KEY } from "../api/client"
import { toast } from "./toastStore"
import type { User } from "../types"

interface AuthState {
  user: User | null
  loading: boolean
  initError: unknown
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initError: null,

  init: async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      set({ loading: false, initError: null })
      return
    }
    set({ loading: true, initError: null })
    try {
      const { data } = await authApi.me()
      set({ user: data.user, loading: false })
    } catch (e) {
      // On ne supprime le token que si le serveur dit "non authentifié".
      // Une API injoignable ne doit pas déconnecter l'utilisateur.
      const unauthorized = isAxiosError(e) && e.response?.status === 401
      if (unauthorized) localStorage.removeItem(TOKEN_KEY)
      set({ user: null, loading: false, initError: unauthorized ? null : e })
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    set({ user: data.user, initError: null })
  },

  register: async (name, email, password, passwordConfirmation) => {
    const { data } = await authApi.register({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    set({ user: data.user, initError: null })
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
  toast.error(i18n.t("errors.session_expired", { defaultValue: "Votre session a expiré. Reconnectez-vous." }))
})