import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type AdminActivityLog } from "../../api/admin"
import { saveBlob } from "../../lib/download"
import { toast } from "../../stores/toastStore"
import { EmptyState, ErrorState, LoadingState } from "../../components/States"
import Pagination from "../../components/Pagination"
import { Pill, Svg } from "../../components/admin/ui"
import { Avatar, Hero, ICON, heroBtnGhost } from "../../components/admin/formationUi"

interface CatMeta { label: string; tone: string }

const CAT: Record<string, CatMeta> = {
  order: { label: "Commande", tone: "bg-sky-500/10 text-sky-700" },
  payment: { label: "Paiement", tone: "bg-emerald-500/10 text-emerald-700" },
  stock: { label: "Stock", tone: "bg-amber-500/15 text-amber-700" },
  product: { label: "Produit", tone: "bg-violet-500/10 text-violet-700" },
  category: { label: "Catégorie", tone: "bg-violet-500/10 text-violet-700" },
  shipping: { label: "Livraison", tone: "bg-sky-500/10 text-sky-700" },
  invoice: { label: "Facture", tone: "bg-slate-500/10 text-slate-700" },
  user: { label: "Utilisateur", tone: "bg-primary/10 text-primary" },
  auth: { label: "Connexion", tone: "bg-primary/10 text-primary" },
  login: { label: "Connexion", tone: "bg-primary/10 text-primary" },
  course: { label: "Cours", tone: "bg-emerald-500/10 text-emerald-700" },
  enrollment: { label: "Inscription", tone: "bg-emerald-500/10 text-emerald-700" },
  certificate: { label: "Certificat", tone: "bg-amber-500/15 text-amber-700" },
  session: { label: "Séance", tone: "bg-emerald-500/10 text-emerald-700" },
  live: { label: "Direct", tone: "bg-danger/10 text-danger" },
  quiz: { label: "Examen", tone: "bg-emerald-500/10 text-emerald-700" },
  faq: { label: "FAQ", tone: "bg-slate-500/10 text-slate-700" },
  settings: { label: "Paramètres", tone: "bg-slate-500/10 text-slate-700" },
  presentation: { label: "Présentation", tone: "bg-slate-500/10 text-slate-700" },
}
const OTHER: CatMeta = { label: "Autre", tone: "bg-line/60 text-muted" }

const VERBS: Record<string, string> = {
  created: "créé(e)", create: "création", updated: "modifié(e)", update: "modification", deleted: "supprimé(e)", delete: "suppression",
  paid: "payé(e)", mark_paid: "marquée payée", cancelled: "annulé(e)", canceled: "annulé(e)", cancel: "annulation",
  blocked: "bloqué", unblocked: "débloqué", login: "connexion", logout: "déconnexion", failed: "échec", refunded: "remboursé(e)",
  adjusted: "ajusté", adjust: "ajustement", issued: "délivré(e)", revoked: "révoqué(e)", restored: "rétabli(e)", sent: "envoyé(e)",
  approved: "acceptée", rejected: "refusée", published: "publié(e)", unpublished: "masqué(e)", imported: "import", exported: "export",
  fulfillment: "suivi", resolved: "traité(e)", started: "démarré", stopped: "arrêté", reset: "réinitialisé",
}

const QUICK = [
  { label: "Tout", kw: "" },
  { label: "Commandes", kw: "order" },
  { label: "Paiements", kw: "payment" },
  { label: "Stock", kw: "stock" },
  { label: "Produits", kw: "product" },
  { label: "Utilisateurs", kw: "user" },
  { label: "Formations", kw: "course" },
  { label: "Certificats", kw: "certificate" },
  { label: "Factures", kw: "invoice" },
  { label: "Paramètres", kw: "settings" },
]

const SUBJECTS: Record<string, string> = {
  Order: "Commande", Product: "Produit", User: "Utilisateur", Course: "Cours", Enrollment: "Inscription",
  Invoice: "Facture", Certificate: "Certificat", Category: "Catégorie", Faq: "FAQ", LiveSession: "Séance",
}

function parts(action: string) {
  return action.split(/[._:\-/]/).filter(Boolean)
}

function catOf(action: string): CatMeta {
  return CAT[parts(action)[0]?.toLowerCase() ?? ""] ?? OTHER
}

function titleOf(action: string): string {
  const p = parts(action)
  const cat = CAT[p[0]?.toLowerCase() ?? ""]
  const rest = (cat ? p.slice(1) : p).map((w) => VERBS[w.toLowerCase()] ?? w.replace(/_/g, " "))
  const verb = rest.join(" ")
  if (!cat) return verb || action
  return verb ? `${cat.label} · ${verb}` : cat.label
}

function subjectOf(l: AdminActivityLog) {
  if (!l.subject_type) return null
  const base = l.subject_type.split("\\").pop() ?? l.subject_type
  return { base, label: SUBJECTS[base] ?? base, id: l.subject_id }
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Oui" : "Non"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function Mark({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-accent/30 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function Detail({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

function LogItem({ log, q, locale }: { log: AdminActivityLog; q: string; locale: string }) {
  const [open, setOpen] = useState(false)
  const cat = catOf(log.action)
  const subject = subjectOf(log)
  const meta = log.metadata && typeof log.metadata === "object" ? Object.entries(log.metadata) : []
  const time = new Date(log.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  const subjectText = subject ? `${subject.label}${subject.id ? ` #${subject.id}` : ""}` : null

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2))
      toast.success("Entrée copiée.")
    } catch {
      toast.error("Copie impossible.")
    }
  }

  return (
    <li className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-start gap-3 p-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${cat.tone}`} aria-hidden="true">
          {cat.label.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold"><Mark text={titleOf(log.action)} q={q} /></p>
            {subjectText && (
              subject?.base === "Order" && subject.id ? (
                <Link to={`/admin/boutique/commandes?q=${subject.id}`} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:underline">
                  <Mark text={subjectText} q={q} />
                </Link>
              ) : (
                <Pill><Mark text={subjectText} q={q} /></Pill>
              )
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={log.user_name ?? "?"} size="sm" />
              <span className="font-medium text-ink"><Mark text={log.user_name ?? "Système"} q={q} /></span>
            </span>
            {log.user_email && <span className="break-all"><Mark text={log.user_email} q={q} /></span>}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted"><Mark text={log.action} q={q} /></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{time}</span>
          <button
            type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
            className="min-h-[36px] rounded-lg border border-line px-2.5 text-xs font-semibold text-primary transition hover:bg-black/5 active:scale-95"
          >
            {open ? "Masquer" : "Détails"}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-page/60 p-4">
          <dl className="grid gap-x-6 gap-y-3 min-[520px]:grid-cols-2">
            <Detail k="Date et heure">{new Date(log.created_at).toLocaleString(locale, { dateStyle: "full", timeStyle: "medium" })}</Detail>
            <Detail k="Auteur">{log.user_name ?? "Système"}{log.user_email ? ` (${log.user_email})` : ""}</Detail>
            <Detail k="Action"><span className="font-mono text-xs">{log.action}</span></Detail>
            <Detail k="Objet concerné">{subjectText ?? "—"}{log.subject_type ? <span className="block font-mono text-[11px] text-muted">{log.subject_type}</span> : null}</Detail>
            <Detail k="N° d'entrée">#{log.id}</Detail>
          </dl>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Données enregistrées ({meta.length})</h4>
            {meta.length === 0 ? (
              <p className="text-sm text-muted">Aucune donnée supplémentaire.</p>
            ) : (
              <dl className="grid gap-x-6 gap-y-3 min-[520px]:grid-cols-2">
                {meta.map(([k, v]) => (
                  <Detail key={k} k={k.replace(/_/g, " ")}><Mark text={fmtVal(v)} q={q} /></Detail>
                ))}
              </dl>
            )}
          </div>

          <button type="button" onClick={() => void copy()} className="min-h-[40px] rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-black/5 active:scale-95">
            Copier l'entrée complète
          </button>
        </div>
      )}
    </li>
  )
}

export default function AdminActivityPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en-US" : "fr-FR"
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    const id = setTimeout(() => { setQ(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [input])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-activity", page, q],
    queryFn: async () => (await adminApi.activityLogs(page, q)).data,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const rows = data?.data ?? []

  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const yest = new Date()
    yest.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
    if (d.toDateString() === yest.toDateString()) return "Hier"
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  }
  const groups: { day: string; items: AdminActivityLog[] }[] = []
  for (const l of rows) {
    const day = dayLabel(l.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(l)
    else groups.push({ day, items: [l] })
  }

  function exportCsv() {
    const esc = (v: unknown) => {
      let s = String(v ?? "")
      if (s !== "" && ["=", "+", "-", "@"].includes(s[0])) s = "'" + s
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [["Date", "Auteur", "E-mail", "Action", "Objet", "Données"].map(esc).join(";")]
    for (const l of rows) {
      const s = subjectOf(l)
      lines.push([
        new Date(l.created_at).toLocaleString(locale), l.user_name ?? "Système", l.user_email ?? "", l.action,
        s ? `${s.label} #${s.id ?? ""}` : "", l.metadata ? JSON.stringify(l.metadata) : "",
      ].map(esc).join(";"))
    }
    saveBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `journal-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-5">
      <Hero
        title={t("admin.activity", { defaultValue: "Journal d'activité" })}
        count={data?.meta.total}
        subtitle="Toutes les actions faites dans l'administration : qui, quoi, sur quel objet et quand."
        actions={
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className={heroBtnGhost}>
            <Svg d={ICON.download} className="h-4 w-4" />Exporter la page (CSV)
          </button>
        }
      />

      <div className="space-y-3 rounded-card border border-line bg-surface p-3.5 shadow-card sm:p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Svg d={ICON.search} className="h-4 w-4" /></span>
          <input
            type="search" data-tour="lg-search" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Rechercher : nom, e-mail, action, n° de commande, mot-clé…"
            aria-label="Rechercher dans le journal"
            className="min-h-[48px] w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Catégories">
          {QUICK.map((c) => {
            const active = q.toLowerCase() === c.kw
            return (
              <button
                key={c.label} type="button" aria-pressed={active} onClick={() => setInput(c.kw)}
                className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.97] ${
                  active ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink"
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        {q && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted" aria-live="polite">
            {isFetching ? "Recherche…" : `${data?.meta.total ?? 0} résultat(s) pour « ${q} »`}
            <button type="button" onClick={() => setInput("")} className="font-semibold text-primary hover:underline">Effacer</button>
          </p>
        )}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && rows.length === 0 && (
        <EmptyState message={q ? `Aucun résultat pour « ${q} ».` : t("admin.no_activity", { defaultValue: "Aucune activité enregistrée." })} />
      )}

      {rows.length > 0 && (
        <div data-tour="lg-table" className={`space-y-5 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g.day} · {g.items.length}</h2>
              <ul className="space-y-2.5">
                {g.items.map((l) => <LogItem key={l.id} log={l} q={q} locale={locale} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </div>
  )
}
