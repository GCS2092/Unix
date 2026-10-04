import { useState, type FormEvent } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { meetingApi } from "../api/meeting"
import LiveRoom from "../components/LiveRoom"
import Button from "../components/Button"

export default function GuestJoinPage() {
  const { invite = "" } = useParams()
  const [name, setName] = useState("")
  const [ready, setReady] = useState(false)

  const status = useQuery({
    queryKey: ["guest-status", invite],
    queryFn: async () => (await meetingApi.guestStatus(invite)).data.data,
    enabled: invite !== "",
    refetchInterval: 5000,
    staleTime: 0,
    retry: false,
  })

  const invalid = !status.data && (status.error as { response?: { status?: number } } | null)?.response?.status === 404

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length >= 2) setReady(true)
  }

  if (invalid || invite === "") {
    return (
      <div className="mx-auto mt-10 max-w-sm rounded-card border border-line bg-surface p-5 text-center shadow-card">
        <h1 className="mb-1 text-lg font-bold">Lien invalide</h1>
        <p className="text-sm text-muted">Ce lien d'invitation est invalide ou a expiré. Demandez-en un nouveau à l'organisateur.</p>
      </div>
    )
  }

  const live = status.data?.is_live

  return (
    <div className="mx-auto max-w-5xl p-4">
      {!ready ? (
        <form onSubmit={submit} className="mx-auto mt-10 max-w-sm rounded-card border border-line bg-surface p-5 shadow-card">
          <h1 className="mb-1 text-lg font-bold">Rejoindre la réunion</h1>
          {status.data?.title && <p className="mb-1 text-sm font-semibold">{status.data.title}</p>}
          <p className="mb-4 text-sm text-muted">
            {live === false
              ? "La session n'a pas encore commencé. Saisissez votre nom : vous patienterez dans la salle d'attente et entrerez automatiquement."
              : "Saisissez votre nom pour entrer. Aucun compte n'est nécessaire."}
          </p>
          <label htmlFor="guest-name" className="block text-sm font-semibold">Votre nom</label>
          <input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            className="mb-4 mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
          />
          <Button type="submit" disabled={name.trim().length < 2}>Continuer</Button>
        </form>
      ) : (
        <LiveRoom courseId={0} guest={{ invite, name: name.trim() }} live={live} autoJoin />
      )}
    </div>
  )
}