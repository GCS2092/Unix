import { useTranslation } from "react-i18next"
import { buttonClass } from "./Button"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"

interface Props {
  productName: string
  productUrl: string
  display?: "icon" | "short" | "full"
  className?: string
}

const Icon = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
  </svg>
)

export default function WhatsAppButton({ productName, productUrl, display = "short", className = "" }: Props) {
  const { t } = useTranslation()
  if (!WHATSAPP_NUMBER) return null

  const href = whatsappUrl(t("ux.wa_message", { name: productName, url: productUrl }))

  if (display === "full") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("ux.wa_ask")}
        className={`group flex min-h-[52px] w-full items-center gap-3 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-[#0f6b4a] transition duration-150 hover:bg-[#25D366]/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 ${className}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition group-hover:scale-105">
          <Icon />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-sm font-semibold">{t("ux.wa_ask")}</span>
          <span className="block text-xs text-[#0f6b4a]/80">{t("ux.wa_reply")}</span>
        </span>
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