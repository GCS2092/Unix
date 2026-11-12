const raw = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? "")

// Valeur de secours (.env). Le numero reel vient de Parametres > Contact (support_whatsapp).
export const WHATSAPP_NUMBER = raw.replace(/\D/g, "")

let current = WHATSAPP_NUMBER
export const setWhatsappNumber = (n: string) => { current = n }
export const getWhatsappNumber = () => current

export const whatsappUrl = (message: string, number: string = current) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`