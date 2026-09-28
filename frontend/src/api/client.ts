import axios from "axios"
import i18n from "../i18n"

export const TOKEN_KEY = "auth_token"

export const apiClient = axios.create({
  baseURL: "/api/v1",
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event("auth:expired"))
    }
    return Promise.reject(error)
  },
)

export async function ensureCsrfCookie(): Promise<void> {
  await axios.get("/sanctum/csrf-cookie", { withCredentials: true })
}