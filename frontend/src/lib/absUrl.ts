export function absUrl(u: string): string {
  return new URL(u, window.location.origin).toString()
}
