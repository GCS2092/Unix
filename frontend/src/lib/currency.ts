export const BASE_CURRENCY = "XOF"
export const CURRENCIES = ["XOF", "EUR", "USD"] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

// Taux de secours (1 XOF = x devise), remplaces par ceux du backend
export const DEFAULT_RATES: Record<string, number> = { XOF: 1, EUR: 1 / 655.957, USD: 1 / 600 }

export function formatMoney(amountXof: number, currency: string, rates: Record<string, number>, locale: string): string {
  const value = amountXof * (rates[currency] ?? 1)
  if (currency === "XOF") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))} FCFA`
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)
}