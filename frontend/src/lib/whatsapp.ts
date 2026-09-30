const raw = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? "")

export const WHATSAPP_NUMBER = raw.replace(/\D/g, "")

export const whatsappUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`