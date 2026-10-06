import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../../api/client"
import { liveAdminApi } from "../../api/live"
import { useLiveStatus } from "../../lib/useLiveStatus"
import { useLiveText } from "../../lib/liveText"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import Button from "../../components/Button"
import LiveRoom from "../../components/LiveRoom"
import ShareLink from "../../components/live/ShareLink"
import MeetingPanel from "../../components/live/MeetingPanel"
import AdmissionPanel from "../../components/live/AdmissionPanel"
import InvitePanel from "../../components/live/InvitePanel"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"

interface CourseRow {
  id: number
  title: string
}

export default function AdminLivePage() {
  const L = useLiveText()
  const qc = useQueryClient()
  const live = useLiveStatus()
  const [selected, setSelected] = useState<number | null>(null)

  const courses = useQuery({
    queryKey: ["admin-live-courses"],
    queryFn: async () => {
      const res = await apiClient.get("/admin/courses", { params: { per_page: 100 } })
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as CourseRow[]
    },
  })

  const refresh = () => void qc.invalidateQueries({ queryKey: ["live-status"] })

  const start = useMutation({
    mutationFn: (id: number) => liveAdminApi.start(id),
    onSuccess: () => { refresh(); toast.info(L.started) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const stop = useMutation({
    mutationFn: (id: number) => liveAdminApi.stop(id),
    onSuccess: () => { refresh(); toast.info(L.stopped) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const rows = courses.data ?? []
  const current = selected ?? rows[0]?.id ?? null
  const isLive = current !== null && live.isLive(current) === true
  const currentTitle = rows.find((c) => c.id === current)?.title ?? ""
  const link = current !== null ? `${window.location.origin}/etudiant/direct/${current}` : ""

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">{L.pageTitle}</h1>
      {courses.isLoading && <ListSkeleton rows={2} />}
      {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data && rows.length === 0 && <p className="text-sm text-muted">{L.noCourses}</p>}

      {rows.length > 0 && current !== null && (
        <>
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <label htmlFor="live-course" className="block text-sm font-semibold">{L.pickCourse}</label>
            <select
              id="live-course"
              value={current}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm"
            >
              {rows.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${isLive ? "bg-danger text-white" : "bg-line text-muted"}`}>
                {isLive ? L.liveNow : L.notLive}
              </span>
              {isLive ? (
                <Button
                  variant="secondary"
                  loading={stop.isPending}
                  onClick={() => { if (window.confirm(L.stopConfirm)) stop.mutate(current) }}
                >
                  {L.stop}
                </Button>
              ) : (
                <Button loading={start.isPending} onClick={() => start.mutate(current)}>{L.start}</Button>
              )}
            </div>
          </div>

          <ShareLink url={link} title={currentTitle} />
          <MeetingPanel courseId={current} />
          <AdmissionPanel courseId={current} />
          <InvitePanel courseId={current} courses={rows} />
        </>
      )}

      {isLive && current !== null && <LiveRoom key={current} courseId={current} live studio />}
    </div>
  )
}