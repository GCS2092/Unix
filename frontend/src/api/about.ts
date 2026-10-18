import { apiClient } from "./client"

export interface AboutData {
  tagline_fr: string
  tagline_en: string
  story_fr: string
  story_en: string
  youtube: string
  x: string
  linkedin: string
  snapchat: string
  telegram: string
  website: string
  banner_home_url: string
  banner_about_url: string
}

export type ExtraKey = "youtube" | "x" | "linkedin" | "snapchat" | "telegram" | "website"

export const EXTRA_LINKS: { key: ExtraKey; label: string; placeholder: string }[] = [
  { key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@unix" },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/unix" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/unix" },
  { key: "snapchat", label: "Snapchat", placeholder: "https://www.snapchat.com/add/unix" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/unix" },
  { key: "website", label: "Site web", placeholder: "https://www.exemple.com" },
]

export const aboutApi = {
  get: () => apiClient.get<{ data: AboutData }>("/api/v1/public/about"),
  adminGet: () => apiClient.get<{ data: AboutData }>("/admin/settings/about"),
  adminUpdate: (payload: Partial<AboutData>) => apiClient.put<{ data: AboutData }>("/admin/settings/about", payload),
}

export type BannerSlot = "home" | "about"

export const aboutBannerApi = {
  upload: (slot: BannerSlot, file: File) => {
    const form = new FormData()
    form.append("image", file)
    return apiClient.post<{ data: AboutData }>(`/admin/settings/about/banner/${slot}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  remove: (slot: BannerSlot) => apiClient.delete<{ data: AboutData }>(`/admin/settings/about/banner/${slot}`),
}