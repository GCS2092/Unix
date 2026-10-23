import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminCourse, type CoursePayload } from "../../api/admin"
import { instructorsApi } from "../../api/instructors"
import { apiClient } from "../../api/client"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import RichEditor from "./RichEditor"
import CourseCoverField from "./CourseCoverField"
import CourseGalleryField from "./CourseGalleryField"
import { field, panel } from "./PageHeader"

const nz = (s: string) => (s.trim() === "" ? null : s)
const LAST = 4

function Stepper({ step, labels, onGo, canGo }: { step: number; labels: string[]; onGo: (n: number) => void; canGo: (n: number) => boolean }) {
  const pct = (step / (labels.length - 1)) * 100
  return (
    <nav aria-label="Progression" className="mb-1">
      <div className="relative mx-4">
        <div className="absolute left-0 right-0 top-4 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute left-0 top-4 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        <ol className="relative flex justify-between">
          {labels.map((l, i) => {
            const done = i < step
            const current = i === step
            const ok = canGo(i)
            return (
              <li key={l} className="flex w-0 flex-col items-center" aria-current={current ? "step" : undefined}>
                <button
                  type="button" disabled={!ok} onClick={() => onGo(i)} aria-label={l}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    done ? "border-primary bg-primary text-white"
                    : current ? "border-primary bg-surface text-primary ring-4 ring-primary/15"
                    : "border-line bg-surface text-muted"
                  } ${ok ? "cursor-pointer" : "cursor-default"}`}
                >
                  {done ? "✓" : i + 1}
                </button>
                <span className={`mt-1.5 hidden whitespace-nowrap text-xs font-semibold md:block ${current ? "text-primary" : "text-muted"}`}>{l}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-primary md:hidden">
        {step + 1} / {labels.length} · {labels[step]}
      </p>
    </nav>
  )
}

function LangTabs({ lang, setLang }: { lang: "fr" | "en"; setLang: (l: "fr" | "en") => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
          className={`min-h-[36px] rounded-md px-4 transition ${lang === l ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {l === "fr" ? "Français" : "English"}
        </button>
      ))}
    </div>
  )
}

export default function CourseForm({ course, canAssign, onDone }: { course: AdminCourse | null; canAssign: boolean; onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const editing = course !== null
  const topRef = useRef<HTMLFormElement>(null)

  const [step, setStep] = useState(0)
  const [lang, setLang] = useState<"fr" | "en">("fr")
  const [title, setTitle] = useState(course?.title ?? "")
  const [description, setDescription] = useState(course?.description ?? "")
  const [price, setPrice] = useState(String(course?.price ?? 0))
  const [video, setVideo] = useState(course?.stream_video_id ?? "")
  const [room, setRoom] = useState(course?.livekit_room ?? "")
  const [duration, setDuration] = useState(course?.duration_seconds ? String(Math.round(course.duration_seconds / 60)) : "")
  const [published, setPublished] = useState(course?.is_published ?? false)
  const [instructor, setInstructor] = useState(course?.instructor_id ? String(course.instructor_id) : "")
  const [error, setError] = useState<string | null>(null)
  const [titleEn, setTitleEn] = useState(course?.title_en ?? "")
  const [descriptionEn, setDescriptionEn] = useState(course?.description_en ?? "")
  const [objectives, setObjectives] = useState(course?.objectives ?? "")
  const [objectivesEn, setObjectivesEn] = useState(course?.objectives_en ?? "")
  const [program, setProgram] = useState(course?.program ?? "")
  const [programEn, setProgramEn] = useState(course?.program_en ?? "")
  const [audience, setAudience] = useState(course?.audience ?? "")
  const [audienceEn, setAudienceEn] = useState(course?.audience_en ?? "")
  const [prerequisites, setPrerequisites] = useState(course?.prerequisites ?? "")
  const [prerequisitesEn, setPrerequisitesEn] = useState(course?.prerequisites_en ?? "")
  const [productId, setProductId] = useState(course?.product_id ? String(course.product_id) : "")

  const productOptions = useQuery({
    queryKey: ["admin-product-options"],
    queryFn: async () => (await apiClient.get<{ data: { id: number; name: string; course_id: number | null }[] }>("/admin/product-options")).data.data,
    enabled: canAssign,
  })
  const instructors = useQuery({
    queryKey: ["admin-instructors"],
    queryFn: async () => (await instructorsApi.list()).data.data,
    enabled: canAssign,
  })

  const labels = [
    t("px.crs.step_info", { defaultValue: "Infos" }),
    t("px.crs.step_content", { defaultValue: "Contenu" }),
    t("px.crs.step_media", { defaultValue: "Médias" }),
    t("px.crs.step_price", { defaultValue: "Tarif et vidéo" }),
    t("px.crs.step_publish", { defaultValue: "Publication" }),
  ]
  const hints = [
    t("px.crs.hint_info", { defaultValue: "Le titre et la description présentent la formation." }),
    t("px.crs.hint_content", { defaultValue: "Ce que l'étudiant va apprendre, le programme, le public visé et les prérequis." }),
    t("px.crs.hint_media", { defaultValue: "Une belle photo donne envie de s'inscrire." }),
    t("px.crs.hint_price", { defaultValue: "Prix en FCFA, durée de la vidéo et identifiants techniques." }),
    t("px.crs.hint_publish", { defaultValue: "Dernière étape : attribuez le cours et choisissez s'il est visible." }),
  ]

  function validate(s: number): string | null {
    if (s === 0 && !title.trim()) {
      setLang("fr")
      return "Le titre en français est obligatoire."
    }
    if (s === 3) {
      const n = Number(price)
      if (!Number.isInteger(n) || n < 0) return t("admin.price_error")
      if (duration.trim() !== "" && !(Number(duration) > 0)) return "La durée doit être un nombre de minutes supérieur à 0."
    }
    return null
  }

  function validateAll(): { step: number; msg: string } | null {
    for (let s = 0; s <= LAST; s++) {
      const msg = validate(s)
      if (msg) return { step: s, msg }
    }
    return null
  }

  function go(n: number) {
    setError(null)
    setStep(n)
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function next() {
    const msg = validate(step)
    if (msg) return setError(msg)
    go(step + 1)
  }

  const canGo = (n: number) => editing || n <= step

  const save = useMutation({
    mutationFn: (p: CoursePayload) => (course ? adminApi.updateCourse(course.slug, p) : adminApi.createCourse(p)),
    onSuccess: async () => {
      for (const k of ["admin-courses", "admin-live-courses", "admin-product-options", "admin-products"]) {
        await queryClient.invalidateQueries({ queryKey: [k] })
      }
      toast.success(t("admin.saved", { defaultValue: "Enregistré" }))
      onDone()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing && step < LAST) return next()
    setError(null)
    const bad = validateAll()
    if (bad) {
      go(bad.step)
      setError(bad.msg)
      return
    }
    save.mutate({
      title: title.trim(),
      description: description.trim() === "" ? null : description,
      title_en: nz(titleEn.trim()),
      description_en: nz(descriptionEn),
      objectives: nz(objectives),
      objectives_en: nz(objectivesEn),
      program: nz(program),
      program_en: nz(programEn),
      audience: nz(audience),
      audience_en: nz(audienceEn),
      prerequisites: nz(prerequisites),
      prerequisites_en: nz(prerequisitesEn),
      price: Number(price),
      stream_video_id: video.trim() === "" ? null : video.trim(),
      livekit_room: room.trim() === "" ? null : room.trim(),
      duration_seconds: duration.trim() === "" ? null : Math.round(Number(duration) * 60),
      is_published: published,
      ...(canAssign ? { instructor_id: instructor ? Number(instructor) : null } : {}),
      ...(canAssign ? { product_id: productId ? Number(productId) : null } : {}),
    })
  }

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const btnBase = "min-h-[44px] rounded-lg px-5 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
  const hasEn = Boolean(titleEn.trim() || descriptionEn.trim())

  return (
    <form ref={topRef} onSubmit={submit} noValidate data-tour="cs-form" className={`${panel} mb-6 scroll-mt-20 space-y-5 border-t-4 border-t-primary`}>
      <div>
        <h2 className="text-lg font-bold">
          {course ? t("admin.edit_title", { name: course.title }) : t("admin.new_course", { defaultValue: "Nouveau cours" })}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{hints[step]}</p>
      </div>

      <Stepper step={step} labels={labels} onGo={go} canGo={canGo} />

      <div key={step} className="animate-fade-up space-y-4 pt-2">
        {step === 0 && (
          <>
            <LangTabs lang={lang} setLang={setLang} />
            {lang === "fr" ? (
              <>
                <label className="block text-sm font-medium">
                  {t("admin.course_title", { defaultValue: "Titre" })}
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
                </label>
                <RichEditor label={t("admin.description")} rows={6} value={description} onChange={setDescription} />
              </>
            ) : (
              <>
                <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted">Optionnel : sans version anglaise, le site affiche le français.</p>
                <label className="block text-sm font-medium">
                  Title
                  <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={field} />
                </label>
                <RichEditor label="Description" rows={6} value={descriptionEn} onChange={setDescriptionEn} />
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <LangTabs lang={lang} setLang={setLang} />
            {lang === "fr" ? (
              <>
                <RichEditor label="Objectifs : ce que l'étudiant va apprendre" rows={5} value={objectives} onChange={setObjectives} hint="Une puce par objectif." />
                <RichEditor label="Programme" rows={10} value={program} onChange={setProgram} hint="Un titre (H) par module, puis des puces. Chaque module devient un bloc dépliable sur le site." />
                <RichEditor label="Public visé" rows={4} value={audience} onChange={setAudience} />
                <RichEditor label="Prérequis" rows={4} value={prerequisites} onChange={setPrerequisites} />
              </>
            ) : (
              <>
                <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted">Optionnel : sans version anglaise, le site affiche le français.</p>
                <RichEditor label="Objectives: what students will learn" rows={5} value={objectivesEn} onChange={setObjectivesEn} hint="One bullet per objective." />
                <RichEditor label="Curriculum" rows={10} value={programEn} onChange={setProgramEn} hint="One heading (H) per module, then bullets. Each module becomes a collapsible block." />
                <RichEditor label="Who it is for" rows={4} value={audienceEn} onChange={setAudienceEn} />
                <RichEditor label="Prerequisites" rows={4} value={prerequisitesEn} onChange={setPrerequisitesEn} />
              </>
            )}
          </>
        )}

        {step === 2 &&
          (course ? (
            <div className="space-y-6">
              <CourseCoverField slug={course.slug} imageUrl={(course as AdminCourse & { image_url?: string | null }).image_url} />
              <CourseGalleryField slug={course.slug} initial={(course as AdminCourse & { gallery?: { id: number; url: string }[] }).gallery} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-muted">
              {t("px.crs.cover_after_save", { defaultValue: "Enregistrez d'abord le cours pour ajouter sa photo." })}{" "}
              Passez à l'étape suivante : vous pourrez ajouter les images juste après la création.
            </p>
          ))}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {t("admin.price_label")}
              <input type="number" min={0} step={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-medium">
              {t("px.crs.duration", { defaultValue: "Durée de la vidéo (minutes)" })}
              <input type="number" min={1} step={1} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-medium">
              {t("admin.video_id", { defaultValue: "ID vidéo (Bunny Stream)" })}
              <input type="text" value={video} onChange={(e) => setVideo(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-medium">
              {t("admin.live_room", { defaultValue: "Salle live (LiveKit)" })}
              <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} className={field} />
            </label>
          </div>
        )}

        {step === 4 && (
          <>
            {canAssign && (
              <label className="block text-sm font-medium">
                {t("px.crs.instructor", { defaultValue: "Formateur" })}
                <select value={instructor} onChange={(e) => setInstructor(e.target.value)} className={field}>
                  <option value="">{t("px.crs.no_instructor", { defaultValue: "Aucun (visible par l'administration seulement)" })}</option>
                  {instructors.data?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.email})</option>)}
                </select>
              </label>
            )}
            {canAssign && (
              <label className="block text-sm font-medium">
                {t("px.crs.linked_product", { defaultValue: "Produit lié (facultatif)" })}
                <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
                  <option value="">{t("px.crs.no_product", { defaultValue: "Aucun" })}</option>
                  {productOptions.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.course_id && p.course_id !== course?.id ? ` — ${t("px.crs.product_taken", { defaultValue: "déjà lié à un autre cours" })}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  {t("px.crs.linked_product_hint", { defaultValue: "Quand une commande contenant ce produit est payée, l'acheteur est inscrit à ce cours. Choisir un produit déjà lié à un autre cours le déplace." })}
                </span>
              </label>
            )}

            <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-page px-4 py-3 text-sm">
              <span>
                <span className="block font-semibold">{t("admin.published_label")}</span>
                <span className="block text-xs text-muted">{published ? "Visible dans le catalogue." : "Brouillon : invisible pour les étudiants."}</span>
              </span>
              <input type="checkbox" className="h-6 w-6 shrink-0" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            </label>

            <dl className="grid gap-2 rounded-xl bg-primary/5 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted">Titre</dt><dd className="truncate font-semibold">{title.trim() || "—"}</dd></div>
              <div><dt className="text-xs text-muted">Prix</dt><dd className="font-semibold">{price || 0} FCFA</dd></div>
              <div><dt className="text-xs text-muted">Version anglaise</dt><dd className="font-semibold">{hasEn ? "Renseignée" : "Non (français affiché)"}</dd></div>
              <div><dt className="text-xs text-muted">Durée</dt><dd className="font-semibold">{duration ? `${duration} min` : "—"}</dd></div>
            </dl>
          </>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-2 rounded-b-card border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5">
        <button type="button" onClick={onDone} disabled={save.isPending} className={`${btnBase} px-3 text-muted hover:text-ink`}>
          {t("admin.cancel")}
        </button>
        <div className="ml-auto flex min-w-0 flex-1 justify-end gap-2 sm:flex-none">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} disabled={save.isPending} className={`${btnBase} flex-1 border border-line bg-surface hover:bg-black/5 sm:flex-none`}>
              ← {t("px.signup.prev", { defaultValue: "Précédent" })}
            </button>
          )}
          {step < LAST && (
            <button type="button" onClick={next} className={`${btnBase} flex-1 sm:flex-none ${editing ? "border border-line bg-surface hover:bg-black/5" : "bg-primary text-white shadow-sm hover:bg-primary-dark"}`}>
              {t("px.signup.next", { defaultValue: "Suivant" })} →
            </button>
          )}
          {(editing || step === LAST) && (
            <button type="submit" disabled={save.isPending} className={`${btnBase} flex-1 bg-primary text-white shadow-sm hover:bg-primary-dark sm:flex-none`}>
              {save.isPending ? t("admin.saving", { defaultValue: "Enregistrement…" }) : editing ? t("admin.save") : t("px.crs.create", { defaultValue: "Créer le cours" })}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
