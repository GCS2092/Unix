import { useTranslation } from "react-i18next"
import { useId, useState, type InputHTMLAttributes } from "react"

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string
  error?: string
  hint?: string
  onChange: (value: string) => void
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

export default function FormField({ label, error, hint, onChange, type = "text", ...rest }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === "password"
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-[48px] w-full rounded-lg border bg-surface px-3.5 py-2.5 text-base outline-none transition focus:ring-2 ${
            error ? "border-danger focus:ring-danger/20" : "border-line focus:border-primary focus:ring-primary/20"
          } ${isPassword ? "pr-12" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("auth.hide_password") : t("auth.show_password")}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted transition hover:text-ink active:bg-line/60"
          >
            <EyeIcon off={visible} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}