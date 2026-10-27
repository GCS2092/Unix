import { useEffect, useState } from "react"

const TEXT_TYPES = /^(text|search|email|password|tel|url|number|date|)$/i

function isField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return TEXT_TYPES.test(el.type)
  return el.isContentEditable
}

/** Vrai quand un champ a le focus ET que la zone visible a nettement retreci (vrai clavier ouvert). */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    let timer: number | undefined

    const compute = () => {
      const focused = isField(document.activeElement)
      const shrunk = vv ? window.innerHeight - vv.height > 120 : false
      setOpen(focused && shrunk)
    }
    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(compute, ms)
    }

    // Ouverture : on attend que le clavier ait redimensionne la zone visible
    const onIn = () => schedule(120)
    // Fermeture : quasi immediate (50 ms pour laisser passer un changement de champ)
    const onOut = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!isField(document.activeElement)) setOpen(false)
        else compute()
      }, 50)
    }
    // Tap hors d'un champ : on retire le focus et la barre revient tout de suite
    const onTap = (e: Event) => {
      if (isField(e.target)) return
      const a = document.activeElement
      if (a instanceof HTMLElement && isField(a)) a.blur()
      setOpen(false)
    }
    const onResize = () => schedule(0)

    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    document.addEventListener("pointerdown", onTap, { passive: true })
    vv?.addEventListener("resize", onResize)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
      document.removeEventListener("pointerdown", onTap)
      vv?.removeEventListener("resize", onResize)
    }
  }, [])
  return open
}
