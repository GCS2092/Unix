import { useTranslation } from "react-i18next"
import { useId, useState, type InputHTMLAttributes } from "react"

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string
  error?: string
  hint?: string
  onChange: (value: string) => void
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
      <div className="relative mt-1">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-[44px] w-full rounded-lg border bg-surface px-3 py-2 outline-none transition focus:ring-2 ${
            error ? "border-danger focus:ring-danger/20" : "border-line focus:border-primary focus:ring-primary/20"
          } ${isPassword ? "pr-24" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("auth.hide_password") : t("auth.show_password")}
            className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-sm font-medium text-muted hover:text-ink active:bg-line/60"
          >
            {visible ? t("auth.hide") : t("auth.show")}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}