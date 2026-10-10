import type { ReactNode } from "react"

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const LockIcon = () => (
  <Svg>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </Svg>
)

export const UserPlusIcon = () => (
  <Svg>
    <circle cx="10" cy="8" r="4" />
    <path d="M2 21c0-4 3.6-6 8-6" />
    <path d="M18 8v6M15 11h6" />
  </Svg>
)

export const MailIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
)

export const KeyIcon = () => (
  <Svg>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M16 7l3 3" />
  </Svg>
)

export const PackageIcon = ({ small = false }: { small?: boolean }) => (
  <svg viewBox="0 0 24 24" className={small ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
)