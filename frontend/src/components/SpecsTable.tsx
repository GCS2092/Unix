interface Row { k: string | null; v: string }

/** Une ligne par caractéristique : "Matière : cuir". Une ligne sans « : » s'affiche sur toute la largeur. */
function parse(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s+/, ""))
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":")
      return i > 0 && i < 60 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: null, v: l }
    })
}

export default function SpecsTable({ text }: { text: string }) {
  const rows = parse(text)
  if (rows.length === 0) return null
  return (
    <dl className="overflow-hidden rounded-xl border border-line text-sm">
      {rows.map((r, i) =>
        r.k ? (
          <div key={i} className={`grid grid-cols-[2fr_3fr] gap-3 px-3.5 py-2.5 ${i % 2 ? "bg-page/50" : ""}`}>
            <dt className="text-muted">{r.k}</dt>
            <dd className="font-medium">{r.v}</dd>
          </div>
        ) : (
          <div key={i} className={`px-3.5 py-2.5 font-medium ${i % 2 ? "bg-page/50" : ""}`}>{r.v}</div>
        ),
      )}
    </dl>
  )
}