import { useDeferredValue, useState } from "react"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { meetingApi } from "../../api/meeting"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../Button"

interface Props {
  courseId: number
  courses: { id: number; title: string }[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InvitePanel({ courseId, courses }: Props) {
  const [filter, setFilter] = useState("")
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [extra, setExtra] = useState("")
  const [note, setNote] = useState("")

  const list = useQuery({
    queryKey: ["invitees", filter, q],
    queryFn: async () =>
      (await meetingApi.invitees({ course_id: filter ? Number(filter) : undefined, q: q || undefined })).data.data,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

  const rows = list.data ?? []
  const allOn = rows.length > 0 && rows.every((u) => selected.has(u.id))

  const emails = Array.from(new Set(extra.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)))
  const badEmails = emails.filter((e) => !EMAIL.test(e))
  const total = selected.size + emails.length

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      rows.forEach((u) => (allOn ? next.delete(u.id) : next.add(u.id)))
      return next
    })
  }

  const send = useMutation({
    mutationFn: () =>
      meetingApi.sendInvites(courseId, {
        user_ids: Array.from(selected),
        extra_emails: emails,
        message: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      const { sent, failed, skipped = 0 } = res.data.data
      if (skipped > 0) toast.info(`${skipped} adresse(s) sans compte non envoyée(s) : e-mails non configurés. Copiez le lien invité et envoyez-le par WhatsApp.`)
      if (sent > 0) toast.info(`${sent} invitation(s) envoyée(s).`)
      if (failed > 0) toast.error(`${failed} envoi(s) en échec (voir storage/logs/laravel.log).`)
      if (failed === 0) {
        setSelected(new Set())
        setExtra("")
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="font-semibold">Inviter des participants</h2>
      <p className="mt-1 text-xs text-muted">
        Les inscrits à ce cours reçoivent le lien vers leur espace. Les autres reçoivent le lien invité, sans compte, et ne
        sont pas inscrits au cours.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="inv-filter" className="block text-sm font-semibold">Filtrer par formation</label>
          <select
            id="inv-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
          >
            <option value="">Tous les étudiants</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                Inscrits à : {c.title}{c.id === courseId ? " (ce cours)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inv-search" className="block text-sm font-semibold">Rechercher</label>
          <input
            id="inv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou e-mail"
            className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={allOn} disabled={rows.length === 0} onChange={toggleAll} />
          <span className="font-semibold">Tout sélectionner ({rows.length})</span>
        </label>
        <span className="text-muted">{selected.size} sélectionné(s)</span>
      </div>

      <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {list.isLoading && <li className="px-3 py-3 text-sm text-muted">Chargement…</li>}
        {list.error && <li role="alert" className="px-3 py-3 text-sm text-danger">{getErrorMessage(list.error)}</li>}
        {list.data && rows.length === 0 && <li className="px-3 py-3 text-sm text-muted">Aucun étudiant trouvé.</li>}
        {rows.map((u) => {
          const inThis = u.courses.some((c) => c.id === courseId)
          return (
            <li key={u.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-page">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted">{u.email}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {inThis && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Déjà inscrit à ce cours</span>
                    )}
                    {u.courses.filter((c) => c.id !== courseId).slice(0, 3).map((c) => (
                      <span key={c.id} className="rounded-full bg-line px-2 py-0.5 text-[10px] text-muted">{c.title}</span>
                    ))}
                    {u.courses.filter((c) => c.id !== courseId).length > 3 && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-[10px] text-muted">
                        +{u.courses.filter((c) => c.id !== courseId).length - 3}
                      </span>
                    )}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-3">
        <label htmlFor="inv-extra" className="block text-sm font-semibold">Autres e-mails (sans compte, séparés par des virgules)</label>
        <textarea
          id="inv-extra"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        {badEmails.length > 0 && (
          <p role="alert" className="mt-1 text-xs text-danger">Adresse invalide : {badEmails.join(", ")}</p>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor="inv-note" className="block text-sm font-semibold">Message (optionnel)</label>
        <textarea
          id="inv-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ex : session demain à 18h, merci de vous connecter 5 minutes avant."
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button loading={send.isPending} disabled={total === 0 || total > 100 || badEmails.length > 0} onClick={() => send.mutate()}>
          Envoyer l'invitation ({total})
        </Button>
        {total > 100 && <span className="text-xs text-danger">Maximum 100 destinataires par envoi.</span>}
      </div>
    </div>
  )
}