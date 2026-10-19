import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { liveAdminApi } from "../../api/live"
import { useLiveStatus } from "../../lib/useLiveStatus"
import { useLiveText } from "../../lib/liveText"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import LiveRoom from "../../components/LiveRoom"
import ShareLink from "../../components/live/ShareLink"
import MeetingPanel from "../../components/live/MeetingPanel"
import AdmissionPanel from "../../components/live/AdmissionPanel"
import InvitePanel from "../../components/live/InvitePanel"
import { ErrorState } from "../../components/States"
import { ListSkeleton } from "../../components/Skeleton"
import { Svg } from "../../components/admin/ui"
import { EmptyBlock, Hero, ICON, Panel, heroBtn, heroBtnGhost } from "../../components/admin/formationUi"

interface CourseRow {
  id: number
  title: string
}

export default function AdminLivePage() {
  const { t } = useTranslation()
  const L = useLiveText()
  const qc = useQueryClient()
  const live = useLiveStatus()
  const [selected, setSelected] = useState<number | null>(null)

  const courses = useQuery({
    queryKey: ["admin-live-courses"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
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

  const status = (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        isLive ? "bg-danger text-white" : "bg-white/15 text-white"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse bg-white" : "bg-white/60"}`} />
      {isLive ? L.liveNow : L.notLive}
    </span>
  )

  return (
    <div className="space-y-6">
      <Hero
        title={L.pageTitle}
        subtitle={t("px.live.hero", { defaultValue: "Lancez votre direct, partagez le lien et gérez l'accès des participants." })}
        actions={
          current !== null ? (
            <span data-tour="live-controls" className="flex flex-wrap items-center gap-3">
              {status}
              {isLive ? (
                <button
                  type="button" disabled={stop.isPending} className={heroBtnGhost}
                  onClick={() => { if (window.confirm(L.stopConfirm)) stop.mutate(current) }}
                >
                  <Svg d={ICON.video} className="h-4 w-4" />{L.stop}
                </button>
              ) : (
                <button type="button" disabled={start.isPending} className={heroBtn} onClick={() => start.mutate(current)}>
                  <Svg d={ICON.video} className="h-4 w-4" />{L.start}
                </button>
              )}
            </span>
          ) : undefined
        }
      />

      {courses.isLoading && <ListSkeleton rows={2} />}
      {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
      {courses.data && rows.length === 0 && <EmptyBlock icon={ICON.book} text={L.noCourses} />}

      {rows.length > 0 && current !== null && (
        <>
          <Panel icon={ICON.book} title={L.pickCourse}>
            <label htmlFor="live-course" className="sr-only">{L.pickCourse}</label>
            <select
              id="live-course" data-tour="live-course"
              value={current}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {rows.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <div data-tour="live-share" className="min-w-0"><ShareLink url={link} title={currentTitle} /></div>
            <div data-tour="live-meeting" className="min-w-0"><MeetingPanel courseId={current} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div data-tour="live-admission" className="min-w-0"><AdmissionPanel courseId={current} /></div>
            <div data-tour="live-invite" className="min-w-0"><InvitePanel courseId={current} courses={rows} /></div>
          </div>
        </>
      )}

      {isLive && current !== null && <LiveRoom key={current} courseId={current} live studio />}
    </div>
  )
}