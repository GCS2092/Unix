import { useTranslation } from "react-i18next"

interface Props { inStock?: boolean; lowStock?: number | null; className?: string }

export default function StockBadge({ inStock, lowStock, className = "" }: Props) {
  const { t } = useTranslation()
  if (inStock === false) {
    return <span className={`inline-block rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-white ${className}`}>{t("ux.out_of_stock")}</span>
  }
  if (typeof lowStock === "number") {
    return <span className={`inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-ink ${className}`}>{t("ux.low_stock", { count: lowStock })}</span>
  }
  return null
}