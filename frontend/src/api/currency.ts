import axios from "axios"
import type { ApiResource } from "../types"

export interface RatesResponse {
  base: string
  rates: Record<string, number>
}

// La route Laravel est /api/currencies (hors du prefixe /v1)
export const currencyApi = {
  rates: () => axios.get<ApiResource<RatesResponse>>("/api/currencies"),
}