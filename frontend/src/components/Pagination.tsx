import { useTranslation } from "react-i18next"
import type { PaginationMeta } from "../types"
import Button from "./Button"

interface Props {
  meta: PaginationMeta
  onChange: (page: number) => void
}

export default function Pagination({ meta, onChange }: Props) {
  const { t } = useTranslation()
  if (meta.last_page <= 1) return null
  return (
    <div className="mt-6 flex items-center justify-between gap-3 text-sm sm:justify-center">
      <Button variant="secondary" disabled={meta.current_page <= 1} onClick={() => onChange(meta.current_page - 1)}>
        {t("common.previous")}
      </Button>
      <span className="whitespace-nowrap text-muted">{meta.current_page} / {meta.last_page}</span>
      <Button variant="secondary" disabled={meta.current_page >= meta.last_page} onClick={() => onChange(meta.current_page + 1)}>
        {t("common.next")}
      </Button>
    </div>
  )
}