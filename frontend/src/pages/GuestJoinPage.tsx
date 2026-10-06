import { useState, type FormEvent } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { meetingApi, type GuestRequestCreds } from "../api/meeting"
import { getErrorMessage } from "../lib/errors"
import { toast } from "../stores/toastStore"
import LiveRoom from "../components/LiveRoom"
import Button from "../components/Button"

function Card({ title, children }: { title: string; children: string }) {
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-card border border-line bg-surface p-5 text-center shadow-card">
      <h1 className="mb-1 text-lg font-bold">{title}</h1>
      <p className="text-sm text-muted">{children}</p>
    </div>
  )
}

export default function GuestJoinPage() {
  const { invite = "" } = useParams()
  const [name, setName] = useState("")
  const [ready, setReady] = useState(false)
  const [creds, setCreds] = useState<GuestRequestCreds | null>(null)

  const status = useQuery({
    queryKey: ["guest-status", invite],
    queryFn: async () => (await meetingApi.guestStatus(invite)).data.data,
    enabled: invite !== "",
    refetchInterval: 5000,
    staleTime: 0,
    retry: false,
  })

  const request = useMutation({
    mutationFn: () => meetingApi.guestRequest(invite, name.trim()),
    onSuccess: (res) => {
      const d = res.data.data
      if (d.id !== null && d.secret !== null) setCreds({ id: d.id, secret: d.secret })
      setReady(true)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const admission = useQuery({
    queryKey: ["guest-admission", creds?.id],
    queryFn: async () => (await meetingApi.guestRequestStatus(creds!.id, creds!.secret)).data.data.status,
    enabled: ready && creds !== null,
    refetchInterval: (q) => (q.state.data === "admitted" || q.state.data === "denied" ? false : 3000),
    staleTime: 0,
    retry: false,
  })

  const invalid = !status.data && (status.error as { response?: { status?: number } } | null)?.response?.status === 404

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return
    if (status.data?.require_admission) request.mutate()
    else setReady(true)
  }

  if (invalid || invite === "") {
    return <Card title="Lien invalide">Ce lien d'invitation est invalide ou a expiré. Demandez-en un nouveau à l'organisateur.</Card>
  }

  const live = status.data?.is_live
  const state = creds === null ? "admitted" : admission.isError ? "lost" : (admission.data ?? "pending")

  if (ready && state === "pending") {
    return <Card title="En attente d'admission">L'organisateur doit vous autoriser à entrer. Gardez cette page ouverte : vous entrerez dès qu'il vous aura admis.</Card>
  }
  if (ready && state === "denied") {
    return <Card title="Accès refusé">L'organisateur n'a pas accepté votre demande d'entrée.</Card>
  }
  if (ready && state === "lost") {
    return <Card title="Demande introuvable">Votre demande a expiré. Rechargez la page pour en faire une nouvelle.</Card>
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {!ready ? (
        <form onSubmit={submit} className="mx-auto mt-10 max-w-sm rounded-card border border-line bg-surface p-5 shadow-card">
          <h1 className="mb-1 text-lg font-bold">Rejoindre la réunion</h1>
          {status.data?.title && <p className="mb-1 text-sm font-semibold">{status.data.title}</p>}
          <p className="mb-4 text-sm text-muted">
            {status.data?.require_admission
              ? "Saisissez votre nom. L'organisateur devra vous autoriser à entrer."
              : live === false
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
          <Button type="submit" loading={request.isPending} disabled={name.trim().length < 2}>Continuer</Button>
        </form>
      ) : (
        <LiveRoom courseId={0} guest={{ invite, name: name.trim(), request: creds ?? undefined }} live={live} autoJoin />
      )}
    </div>
  )
}