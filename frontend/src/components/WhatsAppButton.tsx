import { useTranslation } from "react-i18next"
import { buttonClass } from "./buttonStyles"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

interface Props {
  productName: string
  productUrl: string
  display?: "link" | "linkShort" | "icon" | "short"
  className?: string
}

const Icon = ({ size = "h-5 w-5" }: { size?: string }) => (
  <svg className={`${size} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
  </svg>
)

export default function WhatsAppButton({ productName, productUrl, display = "link", className = "" }: Props) {
  const { t } = useTranslation()
  if (!WHATSAPP_NUMBER) return null

  const href = whatsappUrl(t("ux.wa_message", { name: productName, url: productUrl }))

  if (display === "link" || display === "linkShort") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-2 text-center text-xs font-medium text-[#0f6b4a] transition hover:underline active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 sm:text-sm ${className}`}
      >
        <Icon size="h-4 w-4" />
        <span>{display === "link" ? t("ux.wa_more") : t("ux.wa_more_short")}</span>
      </a>
    )
  }

  const shape = display === "icon" ? "w-11 shrink-0 !px-0" : "shrink-0"
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("ux.wa_ask")}
      title={t("ux.wa_ask")}
      className={buttonClass({
        variant: "secondary",
        className: `border-[#25D366] text-[#0f6b4a] hover:bg-[#25D366]/10 ${shape} ${className}`,
      })}
    >
      <Icon />
      {display === "short" && <span>{t("ux.wa_short")}</span>}
    </a>
  )
}