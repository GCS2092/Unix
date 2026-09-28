const styles: Record<string, string> = {
  paid: "bg-success/10 text-success",
  pending: "bg-accent/15 text-accent",
  failed: "bg-danger/10 text-danger",
}

export function statusBadgeClass(status: string): string {
  return styles[status] ?? "bg-page text-muted"
}