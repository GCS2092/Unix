interface Option { value: string; label: string }

export default function SegmentedControl({
  options, value, onChange, label,
}: { options: Option[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={
              "min-h-[32px] rounded-md px-2 text-xs sm:px-3 font-semibold transition duration-150 active:scale-[0.97] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
              (active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-page hover:text-ink")
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}