/** Retire la syntaxe ## / puces / **gras** pour les apercus (cartes, listes). */
export function plain(text?: string | null, limit = 0): string {
  let t = (text ?? "").replace(/\r/g, "")
  t = t.replace(/^\s*(#{1,3}|[-•*]|\d+[.)])\s+/gm, "").replace(/\*\*/g, "")
  t = t.replace(/\s+/g, " ").trim()
  return limit > 0 && t.length > limit ? t.slice(0, limit - 1).trimEnd() + "…" : t
}