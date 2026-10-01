import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useConfirmStore, type ConfirmOptions } from "../stores/confirmStore"

function Dialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean, reason: string) => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState("")
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false, "")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false, "") }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? "confirm-message" : undefined}
        className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-card-lg"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">{options.title}</h2>
        {options.message && (
          <p id="confirm-message" className="mt-2 text-sm text-muted">{options.message}</p>
        )}

        {options.reasonLabel && (
          <label className="mt-4 block text-sm font-medium">
            {options.reasonLabel}
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-normal outline-none focus:border-primary"
            />
          </label>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false, "")}
            className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-semibold hover:bg-page"
          >
            {options.cancelLabel ?? t("admin.cancel", { defaultValue: "Annuler" })}
          </button>
          <button
            type="button"
            onClick={() => onClose(true, reason.trim())}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold text-white ${options.danger ? "bg-danger" : "bg-primary"} hover:opacity-90`}
          >
            {options.confirmLabel ?? t("admin.confirm", { defaultValue: "Confirmer" })}
          </button>
        </div>
      </div>
    </div>
  )
}

/** À monter une seule fois dans App.tsx, à côté de <Toaster /> */
export default function ConfirmHost() {
  const current = useConfirmStore((s) => s.current)
  const close = useConfirmStore((s) => s.close)
  return current ? <Dialog key={current.id} options={current} onClose={close} /> : null
}