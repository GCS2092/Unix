export function formatPrice(amount: number, currency = "XOF"): string {
  const label = currency === "XOF" ? "FCFA" : currency
  return `${new Intl.NumberFormat("fr-FR").format(amount)} ${label}`
}
