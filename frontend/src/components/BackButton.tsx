import Button from "./Button"

interface Props {
  onClick: () => void
  label: string
  disabled?: boolean
}

export default function BackButton({ onClick, label, disabled = false }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="w-12 shrink-0 !px-0"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Button>
  )
}
