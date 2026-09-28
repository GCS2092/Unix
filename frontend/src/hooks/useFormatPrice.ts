import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useCurrencyStore } from "../stores/currencyStore"
import { formatMoney } from "../lib/currency"

// Prend un montant en XOF et l'affiche dans la devise choisie
export function useFormatPrice() {
  const currency = useCurrencyStore((s) => s.currency)
  const rates = useCurrencyStore((s) => s.rates)
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  return useCallback((amountXof: number) => formatMoney(amountXof, currency, rates, locale), [currency, rates, locale])
}