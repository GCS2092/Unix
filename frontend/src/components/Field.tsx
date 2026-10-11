import { useId, useState, type InputHTMLAttributes } from "react"
import { Check, CircleAlert } from "lucide-react"

// Style commun pour les <select> et <textarea> places dans un <label>
export const inputCls =
  "mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20"

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label: string
  value: string
  onChange: (value: string) => void
  /** Message d'erreur (null/undefined = champ valide). Affiche apres la sortie du champ ou si forceShow. */
  error?: string | null
  hint?: string
  optional?: string
  forceShow?: boolean
}

export function Field({ label, value, onChange, error, hint, optional, forceShow = false, onBlur, className = "", ...rest }: Props) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const show = touched || forceShow
  const bad = show && !!error
  const good = show && !error && value.trim() !== ""
  const border = bad
    ? "border-danger focus:border-danger focus:ring-danger/20"
    : good
      ? "border-success/60 focus:border-primary focus:ring-primary/20"
      : "border-line focus:border-primary focus:ring-primary/20"
  const message = bad ? error : hint

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({optional})</span>}
        {rest.required && <span aria-hidden="true" className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => { setTouched(true); onBlur?.(e) }}
          aria-invalid={bad}
          aria-describedby={message ? `${id}-msg` : undefined}
          className={`mt-1 min-h-[44px] w-full rounded-lg border bg-surface px-3 py-2 outline-none transition placeholder:text-muted/60 focus:ring-2 ${border} ${bad || good ? "pr-10" : ""}`}
        />
        {bad && <CircleAlert aria-hidden="true" className="field-icon absolute right-3 top-1/2 mt-0.5 h-5 w-5 text-danger" />}
        {good && <Check aria-hidden="true" strokeWidth={3} className="field-icon absolute right-3 top-1/2 mt-0.5 h-5 w-5 text-success" />}
      </div>
      {message && (
        <p id={`${id}-msg`} role={bad ? "alert" : undefined} className={`mt-1 text-xs ${bad ? "text-danger" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  )
}