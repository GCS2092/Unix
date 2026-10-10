import type { ReactNode } from "react"

// Mise en page commune des pages d'authentification (connexion, inscription, mot de passe)
export default function AuthShell({
  icon,
  title,
  subtitle,
  children,
  below,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  below?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-sm py-6 sm:py-10">
      <header className="mb-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{subtitle}</p>}
      </header>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">{children}</div>

      {below && <div className="mt-6 space-y-4">{below}</div>}
    </div>
  )
}