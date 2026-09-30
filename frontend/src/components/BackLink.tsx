import { Link } from "react-router-dom"
import type { ReactNode } from "react"

interface Props {
  to: string
  children: ReactNode
  className?: string
}

export default function BackLink({ to, children, className = "" }: Props) {
  return (
    <Link
      to={to}
      className={
        "group -ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted " +
        "transition hover:text-primary active:bg-line/60 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
        className
      }
    >
      <svg
        className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  )
}
