import { create } from "zustand"
import { persist } from "zustand/middleware"
import { currencyApi } from "../api/currency"
import { BASE_CURRENCY, DEFAULT_RATES } from "../lib/currency"

interface CurrencyState {
  currency: string
  rates: Record<string, number>
  setCurrency: (code: string) => void
  loadRates: () => Promise<void>
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: BASE_CURRENCY,
      rates: DEFAULT_RATES,
      setCurrency: (currency) => set({ currency }),
      loadRates: async () => {
        try {
          const { data } = await currencyApi.rates()
          set({ rates: { ...DEFAULT_RATES, ...data.data.rates } })
        } catch {
          // on garde les taux de secours
        }
      },
    }),
    { name: "currency", partialize: (s) => ({ currency: s.currency }) },
  ),
)