import { useToastStore } from "../stores/toastStore"

const colors = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  info: "bg-ink text-white",
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-20 z-50 flex flex-col items-stretch gap-2 sm:bottom-4 sm:left-auto sm:right-4 sm:top-auto sm:w-96"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          role={t.kind === "error" ? "alert" : undefined}
          className={`pointer-events-auto rounded-lg px-4 py-3 text-left text-sm font-medium shadow-lg ${colors[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}