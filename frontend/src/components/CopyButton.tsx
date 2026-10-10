import { useState } from "react"
import { useTranslation } from "react-i18next"

// Bouton "Copier" : copie une valeur dans le presse-papiers et confirme brievement
export default function CopyButton({ value }: { value: string }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted transition hover:border-primary hover:text-primary"
    >
      {done ? (fr ? "Copi\u00e9" : "Copied") : fr ? "Copier" : "Copy"}
    </button>
  )
}