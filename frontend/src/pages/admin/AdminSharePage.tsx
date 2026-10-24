import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi } from "../../api/admin"
import { toast } from "../../stores/toastStore"
import { ErrorState } from "../../components/States"
import { Skeleton } from "../../components/Skeleton"
import { Pill } from "../../components/admin/ui"

interface CourseRow { id: number; title: string; slug: string; is_published?: boolean }

const inputClass =
  "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
const btnPrimary =
  "min-h-[40px] rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-95"
const btnGhost =
  "inline-flex min-h-[40px] items-center rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95"

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // repli ci-dessous
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function LinkRow({ title, hint, url, message, badge }: { title: string; hint?: string; url: string; message: string; badge?: string }) {
  const { t } = useTranslation()
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  async function copy(text: string, okMsg: string) {
    if (await copyText(text)) toast.success(okMsg)
    else toast.error(t("px.share.copy_failed", { defaultValue: "Copie impossible : sélectionnez le lien et copiez-le à la main." }))
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{title}</p>
        {badge && <Pill>{badge}</Pill>}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <input
        readOnly value={url} onFocus={(e) => e.currentTarget.select()}
        aria-label={title} className={`${inputClass} w-full font-mono text-xs`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary}
          onClick={() => void copy(url, t("px.share.copied", { defaultValue: "Lien copié." }))}>
          {t("px.share.copy_link", { defaultValue: "Copier le lien" })}
        </button>
        <button type="button" className={btnGhost}
          onClick={() => void copy(message, t("px.share.copied_msg", { defaultValue: "Message copié." }))}>
          {t("px.share.copy_message", { defaultValue: "Copier le message" })}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={btnGhost}>
          WhatsApp
        </a>
        {canShare && (
          <button type="button" className={btnGhost}
            onClick={() => void navigator.share({ title, text: message, url }).catch(() => undefined)}>
            {t("px.share.share", { defaultValue: "Partager…" })}
          </button>
        )}
      </div>
    </li>
  )
}

export default function AdminSharePage() {
  const { t } = useTranslation()
  const [base, setBase] = useState(window.location.origin)
  const [search, setSearch] = useState("")
  const root = base.trim().replace(/\/+$/, "")

  const courses = useQuery({
    queryKey: ["admin-courses-share"],
    queryFn: async () => {
      const res = await adminApi.allCourses()
      const raw = res.data?.data ?? res.data ?? []
      return (Array.isArray(raw) ? raw : []) as CourseRow[]
    },
  })

  const rows = (courses.data ?? []).filter((c) => !search.trim() || c.title.toLowerCase().includes(search.trim().toLowerCase()))
  const draft = t("px.share.draft", { defaultValue: "Brouillon (non visible du public)" })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("px.share.title", { defaultValue: "Liens à partager" })}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("px.share.intro", { defaultValue: "Copiez un lien et envoyez-le par WhatsApp, SMS ou e-mail. La personne arrive sur la formation, crée son compte si besoin, puis demande l'accès." })}
        </p>
      </div>

      <label className="block text-sm font-medium">
        {t("px.share.base", { defaultValue: "Adresse du site" })}
        <input data-tour="share-base" value={base} onChange={(e) => setBase(e.target.value)} className={`${inputClass} mt-1 w-full`} />
        <span className="mt-1 block text-xs font-normal text-muted">
          {t("px.share.base_hint", { defaultValue: "Détectée automatiquement. Modifiez-la seulement si le site public a une autre adresse que celle que vous utilisez pour l'administration." })}
        </span>
      </label>

      <section data-tour="share-general" className="rounded-card border border-line bg-surface px-4 shadow-card">
        <h2 className="pt-4 text-base font-bold">{t("px.share.general", { defaultValue: "Liens généraux" })}</h2>
        <ul className="divide-y divide-line">
          <LinkRow
            title={t("px.share.l_signup", { defaultValue: "Inscription à une formation (formulaire complet)" })}
            hint={t("px.share.l_signup_hint", { defaultValue: "Le lien principal : la personne choisit sa formation, crée son compte et envoie sa demande en une seule page." })}
            url={`${root}/formations/inscription`}
            message={`${t("px.share.m_signup", { defaultValue: "Inscrivez-vous à nos formations ici :" })} ${root}/formations/inscription`}
          />
        </ul>
        <ul className="divide-y divide-line">
          <LinkRow
            title={t("px.share.l_register", { defaultValue: "Créer un compte" })}
            hint={t("px.share.l_register_hint", { defaultValue: "Pour quelqu'un qui n'a pas encore de compte." })}
            url={`${root}/inscription`}
            message={`${t("px.share.m_register", { defaultValue: "Créez votre compte ici :" })} ${root}/inscription`}
          />
          <LinkRow
            title={t("px.share.l_login", { defaultValue: "Se connecter" })}
            url={`${root}/connexion`}
            message={`${t("px.share.m_login", { defaultValue: "Connectez-vous ici :" })} ${root}/connexion`}
          />
          <LinkRow
            title={t("px.share.l_catalog", { defaultValue: "Catalogue des cours" })}
            hint={t("px.share.l_catalog_hint", { defaultValue: "Demande une connexion avant d'afficher les cours." })}
            url={`${root}/etudiant/catalogue`}
            message={`${t("px.share.m_catalog", { defaultValue: "Découvrez nos formations :" })} ${root}/etudiant/catalogue`}
          />
        </ul>
      </section>

      <section data-tour="share-course" className="rounded-card border border-line bg-surface px-4 pb-1 shadow-card">
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold">{t("px.share.per_course", { defaultValue: "Un lien par formation" })}</h2>
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("px.share.search", { defaultValue: "Rechercher un cours" })}
            className={`${inputClass} w-full sm:max-w-xs`}
          />
        </div>

        {courses.error && <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />}
        {courses.isLoading && <Skeleton className="my-4 h-32" />}
        {courses.data && rows.length === 0 && (
          <p className="py-4 text-sm text-muted">{t("px.share.none", { defaultValue: "Aucun cours." })}</p>
        )}

        <ul className="divide-y divide-line">
          {rows.map((c) => {
            const url = `${root}/formations/inscription?cours=${encodeURIComponent(c.slug)}`
            return (
              <LinkRow
                key={c.id}
                title={c.title}
                badge={c.is_published === false ? draft : undefined}
                url={url}
                message={`${t("px.share.m_course", { defaultValue: "Inscrivez-vous à la formation" })} « ${c.title} » : ${url}`}
              />
            )
          })}
        </ul>
      </section>
    </div>
  )
}


