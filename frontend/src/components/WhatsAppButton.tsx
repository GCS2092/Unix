import { useTranslation } from "react-i18next"
import { buttonClass } from "./buttonStyles"
import { WHATSAPP_NUMBER } from "../lib/whatsapp"
import { openWaDesk } from "../lib/waDesk"

interface Props {
  productName: string
  productUrl: string
  soldOut?: boolean
  display?: "link" | "linkShort" | "icon" | "short"
  className?: string
}

const Icon = ({ size = "h-5 w-5" }: { size?: string }) => (
  <svg className={`${size} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
  </svg>
)

export default function WhatsAppButton({ productName, productUrl, soldOut = false, display = "link", className = "" }: Props) {
  const { t, i18n } = useTranslation()
  if (!WHATSAPP_NUMBER) return null

  const fr = i18n.language.startsWith("fr")
  // Ouvre le menu flottant : le produit est deja coche, le client confirme avant l'envoi
  const ask = () => openWaDesk({ kind: soldOut ? "restock" : "product", name: productName, url: productUrl })
  const long = soldOut ? (fr ? "Prévenez-moi quand il sera disponible" : "Notify me when it's back") : t("ux.wa_more")
  const short = soldOut ? (fr ? "Me prévenir du retour" : "Notify me") : t("ux.wa_more_short")
  const label = soldOut ? long : t("ux.wa_ask")

  if (display === "link" || display === "linkShort") {
    return (
      <button
        type="button"
        onClick={ask}
        className={`flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md px-2 text-center text-xs font-medium text-[#0f6b4a] transition hover:underline active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 sm:text-sm ${className}`}
      >
        <Icon size="h-4 w-4" />
        <span>{display === "link" ? long : short}</span>
      </button>
    )
  }

  const shape = display === "icon" ? "w-11 shrink-0 !px-0" : "shrink-0"
  return (
    <button
      type="button"
      onClick={ask}
      aria-label={label}
      title={label}
      className={buttonClass({
        variant: "secondary",
        className: `border-[#25D366] text-[#0f6b4a] hover:bg-[#25D366]/10 ${shape} ${className}`,
      })}
    >
      <Icon />
      {display === "short" && <span>{t("ux.wa_short")}</span>}
    </button>
  )
}