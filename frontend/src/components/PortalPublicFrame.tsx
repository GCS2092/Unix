import type { ReactNode } from "react"
import BrandLogo from "./BrandLogo"
import PreferencesMenu from "./PreferencesMenu"

/** Cadre IGA (sans en-tete boutique) pour les pages d'authentification ouvertes depuis l'espace formation. */
export default function PortalPublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="text-lg font-extrabold tracking-tight text-primary"><BrandLogo size="sm" /></span>
        <PreferencesMenu />
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 pb-8">{children}</div>
    </div>
  )
}