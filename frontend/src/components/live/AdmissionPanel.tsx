import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { meetingApi } from "../../api/meeting"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../Button"

export default function AdmissionPanel({ courseId }: { courseId: number }) {
  const qc = useQueryClient()
  const key = ["meeting", courseId]

  const settings = useQuery({
    queryKey: key,
    queryFn: async () => (await meetingApi.show(courseId)).data.data,
    staleTime: 0,
  })
  const enabled = !!settings.data?.require_admission

  const toggle = useMutation({
    mutationFn: (v: boolean) => meetingApi.patch(courseId, { require_admission: v }),
    onSuccess: (res) => {
      qc.setQueryData(key, res.data.data)
      toast.info(res.data.data.require_admission ? "Admission activée : vous autorisez chaque invité." : "Admission désactivée : les invités entrent librement.")
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const list = useQuery({
    queryKey: ["join-requests", courseId],
    queryFn: async () => (await meetingApi.joinRequests(courseId)).data.data,
    enabled,
    refetchInterval: 4000,
    staleTime: 0,
  })

  const refresh = () => void qc.invalidateQueries({ queryKey: ["join-requests", courseId] })

  const decide = useMutation({
    mutationFn: (v: { id: number; admit: boolean }) => meetingApi.decide(courseId, v.id, v.admit),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const all = useMutation({
    mutationFn: () => meetingApi.admitAll(courseId),
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const rows = list.data ?? []

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="font-semibold">Admission des invités</h2>

      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={enabled}
          disabled={toggle.isPending || settings.isLoading}
          onChange={(e) => toggle.mutate(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold">Je dois autoriser chaque invité avant qu'il entre</span>
          <span className="block text-xs text-muted">
            Les étudiants inscrits entrent librement. Seules les personnes arrivant avec le lien d'invitation attendent votre accord.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">En attente ({rows.length})</p>
            {rows.length > 1 && (
              <Button size="sm" variant="secondary" loading={all.isPending} onClick={() => all.mutate()}>Tout admettre</Button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Personne n'attend pour le moment.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                  <span className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => decide.mutate({ id: r.id, admit: true })}>Admettre</Button>
                    <Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: r.id, admit: false })}>Refuser</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}