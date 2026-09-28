import { useTranslation } from "react-i18next"
import { CURRENCIES } from "../lib/currency"
import { useCurrencyStore } from "../stores/currencyStore"
import SegmentedControl from "./SegmentedControl"

const OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c === "XOF" ? "FCFA" : c }))

export default function CurrencySwitcher() {
  const { t } = useTranslation()
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  return <SegmentedControl label={t("common.currency")} options={OPTIONS} value={currency} onChange={setCurrency} />
}