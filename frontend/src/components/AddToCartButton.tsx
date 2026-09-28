import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCartStore } from "../stores/cartStore"
import { toast } from "../stores/toastStore"
import { getErrorMessage } from "../lib/errors"
import Button from "./Button"
import type { CartItemType } from "../types"

export default function AddToCartButton({ type, id }: { type: CartItemType; id: number }) {
  const { t } = useTranslation()
  const add = useCartStore((s) => s.add)
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")

  useEffect(() => {
    if (status !== "done") return
    const timer = setTimeout(() => setStatus("idle"), 2000)
    return () => clearTimeout(timer)
  }, [status])

  async function handleClick() {
    setStatus("loading")
    try {
      await add(type, id)
      setStatus("done")
      toast.success(t("product.added_toast"))
    } catch (e) {
      toast.error(getErrorMessage(e))
      setStatus("idle")
    }
  }

  return (
    <Button full loading={status === "loading"} variant={status === "done" ? "secondary" : "primary"} onClick={() => void handleClick()}>
      {status === "loading" ? t("product.adding") : status === "done" ? t("product.added") : t("product.add")}
    </Button>
  )
}