import { Component, type ReactNode } from "react"
import i18n from "../i18n"
import Button from "./Button"

const STALE_CHUNK = /dynamically imported module|Importing a module script failed|Loading chunk/i

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = STALE_CHUNK.test(error.message)
    return (
      <div role="alert" className="mx-auto max-w-sm py-16 text-center">
        <p className="font-semibold">
          {stale
            ? i18n.t("common.new_version", { defaultValue: "Une nouvelle version est disponible." })
            : i18n.t("common.error_title")}
        </p>
        <p className="mt-1 text-sm text-muted">
          {stale
            ? i18n.t("common.new_version_hint", { defaultValue: "Rechargez la page pour continuer." })
            : i18n.t("common.error_hint", { defaultValue: "Cette page n'a pas pu s'afficher." })}
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>{i18n.t("common.reload")}</Button>
      </div>
    )
  }
}