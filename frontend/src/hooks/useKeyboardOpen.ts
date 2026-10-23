import { useEffect, useState } from "react"

const TEXT_TYPES = /^(text|search|email|password|tel|url|number|date|)$/i

function isField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return TEXT_TYPES.test(el.type)
  return el.isContentEditable
}

/** Vrai quand un champ de saisie a le focus (clavier probablement ouvert). */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let timer: number | undefined
    const onIn = (e: FocusEvent) => {
      window.clearTimeout(timer)
      if (isField(e.target)) setOpen(true)
    }
    const onOut = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setOpen(false), 150)
    }
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
    }
  }, [])
  return open
}