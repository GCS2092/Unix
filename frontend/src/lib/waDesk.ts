export type WaAsk =
  | { kind: "restock"; name: string; url: string }
  | { kind: "order"; id: number; status: string; items: string[]; total: string }
  | { kind: "cart"; lines: string[]; total: string }

export type WaIntent = WaAsk | { kind: "product"; name: string; url: string }

export const WA_EVENT = "wa:open"

// Ouvre le menu WhatsApp flottant depuis n'importe quelle page
export function openWaDesk(intent: WaIntent) {
  window.dispatchEvent(new CustomEvent<WaIntent>(WA_EVENT, { detail: intent }))
}