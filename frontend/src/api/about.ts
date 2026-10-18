import { apiClient } from "./client"

export interface GalleryItem {
  url: string
  hidden: boolean
}

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
  gallery_story: string[]
  gallery_shop: string[]
  gallery_courses: string[]
  gallery_support: string[]
  banner_home_hidden: boolean
  banner_about_hidden: boolean
  gallery_story_items: GalleryItem[]
  gallery_shop_items: GalleryItem[]
  gallery_courses_items: GalleryItem[]
  gallery_support_items: GalleryItem[]
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
  get: () => apiClient.get<{ data: AboutData }>("/public/about"),
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

export type GallerySection = "story" | "shop" | "courses" | "support"

export const GALLERY_SECTIONS: { key: GallerySection; fr: string; en: string }[] = [
  { key: "story", fr: "Notre histoire", en: "Our story" },
  { key: "shop", fr: "La boutique", en: "The shop" },
  { key: "courses", fr: "Les formations", en: "Courses" },
  { key: "support", fr: "Accompagnement", en: "Support" },
]

export const aboutGalleryApi = {
  upload: (section: GallerySection, file: File) => {
    const form = new FormData()
    form.append("image", file)
    return apiClient.post<{ data: AboutData }>(`/admin/settings/about/gallery/${section}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  remove: (section: GallerySection, index: number) =>
    apiClient.delete<{ data: AboutData }>(`/admin/settings/about/gallery/${section}/${index}`),
}

export const aboutVisibilityApi = {
  banner: (slot: BannerSlot, hidden: boolean) =>
    apiClient.patch<{ data: AboutData }>(`/admin/settings/about/banner/${slot}/visibility`, { hidden }),
  gallery: (section: GallerySection, index: number, hidden: boolean) =>
    apiClient.patch<{ data: AboutData }>(`/admin/settings/about/gallery/${section}/${index}/visibility`, { hidden }),
}