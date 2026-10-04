import type { LiveText } from "./liveText"

export const canMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
export const canScreen = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia

export function isInsecure(): boolean {
  return typeof window !== "undefined" && !window.isSecureContext
}

function errName(e: unknown): string {
  return typeof e === "object" && e !== null ? String((e as { name?: unknown }).name ?? "") : ""
}

/** Pour le partage d'ecran : l'utilisateur ferme simplement la fenetre du navigateur. */
export function isUserCancel(e: unknown): boolean {
  return errName(e) === "NotAllowedError"
}

export function mediaError(e: unknown, L: LiveText): string {
  if (isInsecure()) return L.errInsecure
  const name = errName(e)
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return L.errDenied
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return L.errNotFound
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return L.errBusy
  return L.errGeneric
}