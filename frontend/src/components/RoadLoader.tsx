import { useTranslation } from "react-i18next"

// Camionnette de livraison qui roule (SVG + CSS, animations par transform uniquement)
export default function RoadLoader({ compact = false, label }: { compact?: boolean; label?: string }) {
  const { t } = useTranslation()
  const text = label ?? t("states.loading")
  return (
    <div role="status" className="flex flex-col items-center gap-2">
      <div className={`relative overflow-hidden ${compact ? "h-9 w-28" : "h-14 w-44"}`} aria-hidden="true">
        <svg viewBox="0 0 120 56" className="absolute inset-x-0 top-0 h-full w-full">
          <g className="text-primary">
            <g className="speed-lines" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5">
              <line className="speed-line" x1="12" y1="18" x2="2" y2="18" />
              <line className="speed-line" x1="14" y1="26" x2="0" y2="26" />
              <line className="speed-line" x1="12" y1="34" x2="4" y2="34" />
            </g>
            <g className="truck-bob">
              <rect x="18" y="10" width="52" height="28" rx="3" className="fill-primary" />
              <rect x="18" y="29" width="52" height="3" className="fill-accent" />
              <path d="M72 18h16l12 12v8H72z" className="fill-primary-dark" />
              <path d="M76 22h10l8 8H76z" fill="#fff" fillOpacity="0.8" />
              {[30, 88].map((cx) => (
                <g key={cx}>
                  <circle cx={cx} cy={42} r={7} className="fill-ink" />
                  <g className="wheel-spin">
                    <circle cx={cx} cy={42} r={3} fill="#fff" />
                    <line x1={cx - 3} y1={42} x2={cx + 3} y2={42} stroke="#0f172a" strokeWidth="1.2" />
                  </g>
                </g>
              ))}
            </g>
          </g>
        </svg>
        <div className="road-lane" />
      </div>
      {!compact && <span className="text-sm text-muted">{text}</span>}
    </div>
  )
}