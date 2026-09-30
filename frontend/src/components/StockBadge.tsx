import { useTranslation } from "react-i18next"

export default function StockBadge({ stock, className = "" }: { stock?: number; className?: string }) {
  const { t } = useTranslation()
  if (typeof stock !== "number") return null
  if (stock <= 0) {
    return <span className={`inline-block rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-white ${className}`}>{t("ux.out_of_stock")}</span>
  }
  if (stock <= 5) {
    return <span className={`inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-ink ${className}`}>{t("ux.low_stock", { count: stock })}</span>
  }
  return null
}