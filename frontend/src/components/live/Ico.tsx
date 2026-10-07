import type { ReactNode } from "react"

export function Ico({ children, cls = "h-5 w-5" }: { children: ReactNode; cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
