import axios from "axios"
import { apiClient } from "./client"

export interface PublicSiteInfo {
  brand_colors: string
  trust_points: { fr: string; en: string }[]
  whatsapp_staff: string
  whatsapp_message_fr: string
  whatsapp_message_en: string
  vat_enabled: boolean | null
  vat_rate: number | null
  pickup_enabled: boolean | null
  payment_methods: string[]
  certificate_condition: string
  certificate_mention_fr: string
  certificate_mention_en: string
  live_schedule: string
  live_audience: string
}

export const siteInfoApi = {
  publicInfo: () => axios.get<{ data: PublicSiteInfo }>("/api/v1/public/site-info"),
  admin: () => apiClient.get<{ data: Record<string, unknown> }>("/admin/site-info"),
  save: (p: Record<string, unknown>) => apiClient.put<{ data: Record<string, unknown> }>("/admin/site-info", p),
}