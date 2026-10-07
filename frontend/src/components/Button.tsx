import type { ButtonHTMLAttributes } from "react"
import { buttonClass, type StyleOptions } from "./buttonStyles"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  loading?: boolean
}

export default function Button({
  variant, size, full, className, loading = false, disabled, type = "button", children, ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={buttonClass({ variant, size, full, className })}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}