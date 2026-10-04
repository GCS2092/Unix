import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { meetingApi, type MeetingSettings } from "../../api/meeting"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../Button"

export default function MeetingPanel({ courseId }: { courseId: number }) {
  const qc = useQueryClient()
  const key = ["meeting", courseId]
  const input = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await meetingApi.show(courseId)).data.data,
    staleTime: 0,
  })

  const done = (data: MeetingSettings) => qc.setQueryData(key, data)

  const toggle = useMutation({
    mutationFn: (v: boolean) => meetingApi.update(courseId, v),
    onSuccess: (res) => {
      done(res.data.data)
      toast.info(
        res.data.data.meeting_mode
          ? "Mode reunion active : tout le monde peut parler (pour les prochaines connexions)."
          : "Mode classe : seul le formateur parle.",
      )
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const regen = useMutation({
    mutationFn: () => meetingApi.regenerate(courseId),
    onSuccess: (res) => {
      done(res.data.data)
      toast.info("Nouveau lien genere. L'ancien ne fonctionne plus.")
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const token = q.data?.invite_token
  const link = token ? `${window.location.origin}/rejoindre/${token}` : ""

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      input.current?.select()
      document.execCommand("copy")
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (q.isLoading) return null
  if (q.error) return <p role="alert" className="text-sm text-danger">{getErrorMessage(q.error)}</p>

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="font-semibold">Reunion et invitations</h2>

      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={!!q.data?.meeting_mode}
          disabled={toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold">Mode reunion (tout le monde peut parler et activer sa camera)</span>
          <span className="block text-xs text-muted">
            Desactive : mode classe, les participants levent la main et vous les autorisez. Le changement s'applique aux prochaines connexions.
          </span>
        </span>
      </label>

      <div className="mt-4">
        <label htmlFor="invite-link" className="block text-sm font-semibold">Lien d'invitation (sans compte)</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="invite-link"
            ref={input}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-line bg-page px-3 text-sm"
          />
          <Button size="sm" onClick={() => void copy()}>{copied ? "Copie !" : "Copier"}</Button>
          <Button
            size="sm"
            variant="secondary"
            loading={regen.isPending}
            onClick={() => { if (window.confirm("Generer un nouveau lien ? L'ancien sera invalide.")) regen.mutate() }}
          >
            Regenerer
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">Toute personne ayant ce lien peut entrer tant que le direct est lance.</p>
      </div>
    </div>
  )
}