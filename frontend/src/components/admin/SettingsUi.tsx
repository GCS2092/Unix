import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import Button from "../Button"

// Barre fixe en bas d'ecran, visible uniquement quand un champ a change
export function SaveBar({ dirty, saving, onSave, onCancel }: { dirty: boolean; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  if (!dirty) return null
  return (
    <div className="animate-fade-up fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-card-lg backdrop-blur lg:left-64">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 lg:px-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {fr ? "Modifications non enregistrées" : "Unsaved changes"}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={saving} onClick={onCancel}>{fr ? "Annuler" : "Cancel"}</Button>
          <Button loading={saving} onClick={onSave}>{fr ? "Enregistrer" : "Save"}</Button>
        </div>
      </div>
    </div>
  )
}

// Zone qui accepte une image deposee par glisser-deposer
export function ImageDrop({ onFile, disabled = false, className = "", children }: { onFile: (f: File) => void; disabled?: boolean; className?: string; children: ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && !disabled) onFile(file)
      }}
      className={`rounded-card transition ${over ? "ring-2 ring-primary ring-offset-2" : ""} ${className}`}
    >
      {children}
    </div>
  )
}