import { apiClient } from "./client"

export type PresentationSpace = "shop" | "formation"

export interface PItem { title_fr: string; title_en: string; text_fr: string; text_en: string }

export interface PresentationContent {
  published: boolean
  show_courses: boolean
  show_faq: boolean
  hero_title_fr: string
  hero_title_en: string
  hero_subtitle_fr: string
  hero_subtitle_en: string
  intro_fr: string
  intro_en: string
  steps: PItem[]
  advantages: PItem[]
  location_name: string
  location_address_fr: string
  location_address_en: string
  location_hours_fr: string
  location_hours_en: string
  location_map_url: string
  contact_phone: string
  contact_email: string
}

const s = (v: unknown): string => (typeof v === "string" ? v : "")

function items(v: unknown): PItem[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>
    return { title_fr: s(r.title_fr), title_en: s(r.title_en), text_fr: s(r.text_fr), text_en: s(r.text_en) }
  })
}

export function normalizePresentation(raw: Record<string, unknown>): PresentationContent {
  return {
    published: raw.published !== false,
    show_courses: raw.show_courses === true,
    show_faq: raw.show_faq !== false,
    hero_title_fr: s(raw.hero_title_fr),
    hero_title_en: s(raw.hero_title_en),
    hero_subtitle_fr: s(raw.hero_subtitle_fr),
    hero_subtitle_en: s(raw.hero_subtitle_en),
    intro_fr: s(raw.intro_fr),
    intro_en: s(raw.intro_en),
    steps: items(raw.steps),
    advantages: items(raw.advantages),
    location_name: s(raw.location_name),
    location_address_fr: s(raw.location_address_fr),
    location_address_en: s(raw.location_address_en),
    location_hours_fr: s(raw.location_hours_fr),
    location_hours_en: s(raw.location_hours_en),
    location_map_url: s(raw.location_map_url),
    contact_phone: s(raw.contact_phone),
    contact_email: s(raw.contact_email),
  }
}

export const presentationApi = {
  publicGet: (space: PresentationSpace) => apiClient.get<{ data: Record<string, unknown> }>(`/presentations/${space}`),
  adminGet: (space: PresentationSpace) => apiClient.get<{ data: Record<string, unknown> }>(`/admin/presentations/${space}`),
  adminSave: (space: PresentationSpace, p: PresentationContent) =>
    apiClient.put<{ data: Record<string, unknown> }>(`/admin/presentations/${space}`, p),
}