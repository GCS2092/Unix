import { apiClient } from "./client"

export class ImportRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImportRunError"
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Interroge l'etat d'un import en arriere-plan jusqu'a sa fin (tolere quelques coupures reseau). */
export async function waitForRun<T>(runId: number, timeoutMs = 30 * 60_000): Promise<T> {
  const start = Date.now()
  let delay = 1000
  let failures = 0
  for (;;) {
    try {
      const res = await apiClient.get<{ data: { status: string; report: T | null; error: string | null } }>(`/admin/import-runs/${runId}`)
      failures = 0
      const d = res.data.data
      if (d.status === "done" && d.report) return d.report
      if (d.status === "failed") throw new ImportRunError(d.error ?? "L'import a échoué.")
    } catch (e) {
      if (e instanceof ImportRunError) throw e
      if (++failures >= 5) throw e
    }
    if (Date.now() - start > timeoutMs) throw new ImportRunError("L'import prend trop de temps. Vérifiez le résultat dans quelques minutes avant de recommencer.")
    await sleep(delay)
    delay = Math.min(Math.round(delay * 1.5), 5000)
  }
}