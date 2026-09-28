import { Component, type ReactNode } from "react"
import i18n from "../i18n"
import Button from "./Button"

interface State { hasError: boolean }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div role="alert" className="py-16 text-center">
        <p className="text-danger">{i18n.t("common.error_title")}</p>
        <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
          {i18n.t("common.reload")}
        </Button>
      </div>
    )
  }
}