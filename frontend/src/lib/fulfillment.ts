export type FulfillmentStep = "received" | "preparing" | "shipped" | "ready" | "delivered"

export function fulfillmentSteps(method?: string | null): FulfillmentStep[] {
  if (method === "delivery") return ["received", "preparing", "shipped", "delivered"]
  if (method === "pickup") return ["received", "preparing", "ready", "delivered"]
  return []
}

export function fulfillmentLabelKey(step: string, method?: string | null): string {
  return step === "delivered" && method === "pickup" ? "fulfillment.picked_up" : `fulfillment.${step}`
}