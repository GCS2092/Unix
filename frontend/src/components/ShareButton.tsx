import { useTranslation } from "react-i18next"
import { Share2 } from "lucide-react"
import { toast } from "../stores/toastStore"

interface Props { url: string; title: string; text?: string; className?: string }

export default function ShareButton({ url, title, text, className = "" }: Props) {
  const { i18n } = useTranslation()
  const en = (i18n.language || "fr").startsWith("en")
  const lang = en ? "en" : "fr"
  const link = `${url}${url.includes("?") ? "&" : "?"}lang=${lang}`

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url: link })
        return
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return
    }
    try {
      await navigator.clipboard.writeText(link)
      toast.success(en ? "Link copied." : "Lien copié.")
    } catch {
      window.prompt(en ? "Copy this link" : "Copiez ce lien", link)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95 ${className}`}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {en ? "Share" : "Partager"}
    </button>
  )
}