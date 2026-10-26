import axios, { type InternalAxiosRequestConfig } from "axios"
import i18n from "../i18n"

export const TOKEN_KEY = "auth_token"

export const apiClient = axios.create({
  baseURL: "/api/v1",
  timeout: 20_000,
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: "application/json" },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers["Accept-Language"] = i18n.language.slice(0, 2)
  return config
})

type RetryableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response) {
      // Telechargements (blob) : on recupere le message JSON de Laravel
      const { data } = error.response
      if (data instanceof Blob && data.type.includes("json")) {
        try {
          error.response.data = JSON.parse(await data.text())
        } catch {
          // on garde le blob tel quel
        }
      }

      // Jeton CSRF ou session expire (419) : on en demande un nouveau puis on rejoue
      // la requete UNE seule fois, sans que le client ait a recharger la page.
      const original = error.config as RetryableConfig | undefined
      if (error.response.status === 419 && original && !original._csrfRetried) {
        original._csrfRetried = true
        await ensureCsrfCookie(true)
        return apiClient(original)
      }

      if (error.response.status === 401 && localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY)
        window.dispatchEvent(new Event("auth:expired"))
      }
    }
    return Promise.reject(error)
  },
)

let csrfInFlight: Promise<void> | null = null

/**
 * Garantit la presence du cookie XSRF-TOKEN. Avant, une requete /sanctum/csrf-cookie
 * partait avant CHAQUE ecriture (ajout au panier, commande...) : un aller-retour
 * serveur de plus a chaque clic. Maintenant on ne la fait que si le cookie manque
 * (ou en cas de 419, avec force = true), et une seule fois a la fois.
 */
export function ensureCsrfCookie(force = false): Promise<void> {
  if (!force && typeof document !== "undefined" && document.cookie.includes("XSRF-TOKEN=")) {
    return Promise.resolve()
  }
  if (!csrfInFlight) {
    csrfInFlight = axios
      .get("/sanctum/csrf-cookie", { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        csrfInFlight = null
      })
  }
  return csrfInFlight
}
