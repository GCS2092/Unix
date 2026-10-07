type Variant = "primary" | "secondary" | "danger" | "ghost"
type Size = "sm" | "md" | "lg"

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold select-none transition duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-dark active:brightness-90",
  secondary: "border border-line bg-surface text-ink hover:bg-page active:bg-line/60",
  danger: "bg-danger text-white shadow-sm hover:brightness-95 active:brightness-90",
  ghost: "text-primary hover:bg-primary/10 active:bg-primary/20",
}

const sizes: Record<Size, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-sm",
  md: "min-h-[44px] px-4 py-2.5 text-sm",
  lg: "min-h-[48px] px-6 py-3 text-base",
}

export interface StyleOptions {
  variant?: Variant
  size?: Size
  full?: boolean
  className?: string
}

// Utilisable aussi sur un <Link> : <Link className={buttonClass({ variant: "secondary" })}>
export function buttonClass({ variant = "primary", size = "md", full = false, className = "" }: StyleOptions = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`.trim()
}

