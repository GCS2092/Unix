import { useTranslation } from "react-i18next"
import SegmentedControl from "./SegmentedControl"

const LANGS = [{ value: "fr", label: "FR" }, { value: "en", label: "EN" }]

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  return (
    <SegmentedControl
      label={t("common.language")}
      options={LANGS}
      value={i18n.language.slice(0, 2)}
      onChange={(l) => void i18n.changeLanguage(l)}
    />
  )
}