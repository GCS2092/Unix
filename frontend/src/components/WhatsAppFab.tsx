import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import { useAuthStore } from "../stores/authStore"
import { useFormatPrice } from "../hooks/useFormatPrice"
import { WHATSAPP_NUMBER, whatsappUrl } from "../lib/whatsapp"
import { WA_EVENT, type WaAsk, type WaIntent } from "../lib/waDesk"

// Delai sans interaction avant que le bouton se replie sur le bord de l'ecran
const IDLE_MS = 6000

// Pages ou le bouton flottant est masque : barres collees en bas (fiche produit, panier), paiement, plein ecran.
// Le menu reste pourtant ouvrable depuis les boutons de ces pages.
const HIDDEN_ON = [/^\/boutique\/[^/]+/, /^\/panier/, /^\/commande/, /^\/etudiant\/(direct|cours)\//]

type View = "menu" | "courses" | "pick" | "review" | "ask"
interface Picked { name: string; url: string }

const fetchProducts = async (search: string) =>
  (await catalogApi.products({ search: search || undefined, sort: "new" })).data.data

const sendCls =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98]"
const ghostCls = "min-h-[44px] rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
const fieldCls =
  "min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function WhatsAppFab() {
  const { i18n } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const formatPrice = useFormatPrice()
  const queryClient = useQueryClient()
  const fr = i18n.language.startsWith("fr")

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("menu")
  const [intent, setIntent] = useState<WaAsk | null>(null)
  const [tick, setTick] = useState(0)
  const [sleptKey, setSleptKey] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Picked[]>([])
  const [note, setNote] = useState("")
  // null = pas encore modifie par le client : on affiche les infos du compte connecte, s'il y en a
  const [nameEdit, setNameEdit] = useState<string | null>(null)
  const [emailEdit, setEmailEdit] = useState<string | null>(null)
  const name = nameEdit ?? user?.name ?? ""
  const email = emailEdit ?? user?.email ?? ""

  const key = `${pathname}:${tick}`
  const asleep = !open && sleptKey === key
  const wake = () => setTick((n) => n + 1)

  // Charge la liste des produits en avance (survol, toucher ou ouverture du menu)
  const prefetch = () =>
    void queryClient.prefetchQuery({
      queryKey: ["fab-products", ""],
      queryFn: () => fetchProducts(""),
      staleTime: 5 * 60_000,
    })

  // Replie le bouton apres un temps sans interaction (jamais pendant que le menu est ouvert)
  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => setSleptKey(key), IDLE_MS)
    return () => window.clearTimeout(id)
  }, [key, open])

  // Recherche avec petit delai
  useEffect(() => {
    const id = window.setTimeout(() => setQ(input.trim()), 300)
    return () => window.clearTimeout(id)
  }, [input])

  // Des l'ouverture du menu, la liste commence a charger
  useEffect(() => {
    if (open) void queryClient.prefetchQuery({
      queryKey: ["fab-products", ""],
      queryFn: () => fetchProducts(""),
      staleTime: 5 * 60_000,
    })
  }, [open, queryClient])

  // Les boutons des autres pages (produit, commande, panier) ouvrent ce menu avec leur contexte
  useEffect(() => {
    const onOpen = (e: Event) => {
      const it = (e as CustomEvent<WaIntent>).detail
      if (!it) return
      setNote("")
      if (it.kind === "product") {
        setPicked([{ name: it.name, url: it.url }])
        setIntent(null)
        setView("review")
      } else {
        setIntent(it)
        setView("ask")
      }
      setOpen(true)
    }
    window.addEventListener(WA_EVENT, onOpen)
    return () => window.removeEventListener(WA_EVENT, onOpen)
  }, [])

  function closeAll() {
    setOpen(false)
    setView("menu")
    setIntent(null)
    wake()
  }

  // Echap ferme le menu
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setView("menu")
        setIntent(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const products = useQuery({
    queryKey: ["fab-products", q],
    queryFn: () => fetchProducts(q),
    enabled: open && view === "pick",
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  if (!WHATSAPP_NUMBER) return null
  const hideFab = HIDDEN_ON.some((r) => r.test(pathname))

  // Nom et e-mail : facultatifs, ajoutes au message seulement s'ils sont renseignes
  const contact = [
    name.trim() && `${fr ? "Nom" : "Name"} : ${name.trim()}`,
    email.trim() && `${fr ? "E-mail" : "Email"} : ${email.trim()}`,
  ].filter(Boolean).join("\n")
  const contactBlock = contact ? `\n\n${contact}` : ""
  const emailBad = email.trim() !== "" && !EMAIL_RE.test(email.trim())
  const extra = note.trim() ? `\n\n${fr ? "Ma question" : "My question"} : ${note.trim()}` : ""

  const coursesMessage =
    (fr ? "Bonjour, est-ce que vous proposez des formations ?" : "Hello, do you offer courses?") + contactBlock

  const productsMessage = (() => {
    const head = fr
      ? "Bonjour, j'aimerais avoir plus de renseignements sur ce produit :"
      : "Hello, I would like more information about this product:"
    const headMany = fr
      ? "Bonjour, j'aimerais avoir plus de renseignements sur ces produits :"
      : "Hello, I would like more information about these products:"
    const list = picked.map((p, i) => `${i + 1}. ${p.name}\n   ${p.url}`).join("\n")
    return `${picked.length > 1 ? headMany : head}\n${list}${extra}${contactBlock}`
  })()

  const askMessage = (() => {
    if (!intent) return ""
    if (intent.kind === "restock") {
      const head = fr
        ? "Bonjour, ce produit est en rupture de stock. Pouvez-vous me prévenir quand il sera de nouveau disponible ?"
        : "Hello, this product is out of stock. Could you let me know when it is available again?"
      return `${head}\n${intent.name}\n${intent.url}${extra}${contactBlock}`
    }
    if (intent.kind === "order") {
      const head = fr
        ? `Bonjour, j'ai une question sur ma commande n°${intent.id} (${intent.status}).`
        : `Hello, I have a question about my order #${intent.id} (${intent.status}).`
      return `${head}\n${intent.items.map((i) => `- ${i}`).join("\n")}\nTotal : ${intent.total}${extra}${contactBlock}`
    }
    const head = fr ? "Bonjour, j'ai besoin d'aide pour finaliser ma commande. Mon panier :" : "Hello, I need help completing my order. My cart:"
    return `${head}\n${intent.lines.map((l) => `- ${l}`).join("\n")}\nTotal : ${intent.total}${extra}${contactBlock}`
  })()

  const askLines = !intent ? [] : intent.kind === "restock" ? [intent.name] : intent.kind === "order" ? intent.items : intent.lines
  const askTitle = !intent
    ? ""
    : intent.kind === "restock"
      ? fr ? "Me prévenir du retour" : "Notify me"
      : intent.kind === "order"
        ? fr ? `Commande n°${intent.id}` : `Order #${intent.id}`
        : fr ? "Aide pour commander" : "Help ordering"

  function toggle(p: Picked) {
    setPicked((cur) => (cur.some((x) => x.url === p.url) ? cur.filter((x) => x.url !== p.url) : [...cur, p]))
  }

  // Ferme apres l'ouverture de WhatsApp (leger delai pour ne pas couper le lien)
  const afterSend = (reset?: () => void) => {
    window.setTimeout(() => {
      reset?.()
      setNote("")
      closeAll()
    }, 0)
  }

  const waIcon = (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.3A8.4 8.4 0 1 1 21 11.5z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  )

  const contactFields = (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted">
        {fr ? "Pour que nous puissions vous répondre (facultatif)" : "So we can get back to you (optional)"}
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setNameEdit(e.target.value)}
        autoComplete="name"
        maxLength={80}
        placeholder={fr ? "Votre nom" : "Your name"}
        aria-label={fr ? "Votre nom" : "Your name"}
        className={fieldCls}
      />
      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmailEdit(e.target.value)}
        autoComplete="email"
        maxLength={120}
        placeholder={fr ? "Votre e-mail" : "Your email"}
        aria-label={fr ? "Votre e-mail" : "Your email"}
        aria-invalid={emailBad}
        className={`${fieldCls} ${emailBad ? "border-danger" : ""}`}
      />
      {emailBad && (
        <p className="text-xs text-danger" role="alert">
          {fr ? "Cet e-mail semble incorrect. Vérifiez-le avant d'envoyer." : "This email looks incorrect. Please check it before sending."}
        </p>
      )}
    </div>
  )

  const noteField = (
    <textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      rows={3}
      maxLength={400}
      placeholder={fr ? "Votre question (prix, disponibilité, taille…) — facultatif" : "Your question (price, availability, size…) — optional"}
      className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  )

  const title = {
    menu: fr ? "Comment pouvons-nous vous aider ?" : "How can we help?",
    courses: fr ? "Proposez-vous des formations ?" : "Do you offer courses?",
    pick: fr ? "Choisissez le ou les produits" : "Choose one or more products",
    review: fr ? "Vérifiez avant l'envoi" : "Check before sending",
    ask: askTitle,
  }[view]

  const searching = products.isPlaceholderData || (products.isFetching && !products.isLoading)

  return (
    <>
      {open && (
        <>
          <button type="button" aria-label={fr ? "Fermer" : "Close"} className="fixed inset-0 z-40" onClick={closeAll} />
          <div
            role="dialog"
            aria-label="WhatsApp"
            className="animate-fade-up fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-3 z-50 flex max-h-[calc(100dvh-12rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card-lg md:bottom-24 md:right-6"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <div className="flex min-w-0 items-center gap-1">
                {(view === "courses" || view === "pick" || view === "review") && (
                  <button
                    type="button"
                    aria-label={fr ? "Retour" : "Back"}
                    onClick={() => setView(view === "review" ? "pick" : "menu")}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-page hover:text-ink"
                  >
                    ←
                  </button>
                )}
                <p className="truncate text-sm font-bold">{title}</p>
              </div>
              <button type="button" aria-label={fr ? "Fermer" : "Close"} onClick={closeAll} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-page hover:text-ink">
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {view === "menu" && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setView("courses")}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-page active:bg-line/60"
                  >
                    <span className="text-sm font-semibold">{fr ? "Proposez-vous des formations ?" : "Do you offer courses?"}</span>
                    <span aria-hidden="true" className="text-[#128c7e]">→</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("pick")}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-page active:bg-line/60"
                  >
                    <span className="text-sm font-semibold">
                      {fr ? "Puis-je avoir plus de renseignements sur un produit ?" : "Can I get more information about a product?"}
                    </span>
                    <span aria-hidden="true" className="text-[#128c7e]">→</span>
                  </button>
                  <p className="px-3 pb-1 pt-2 text-[11px] text-muted">
                    {fr ? "Rien n'est envoyé tant que vous n'avez pas confirmé." : "Nothing is sent until you confirm."}
                  </p>
                </div>
              )}

              {view === "courses" && (
                <div className="space-y-3 p-1">
                  {contactFields}
                  <p className="text-xs font-semibold text-muted">{fr ? "Message qui sera envoyé :" : "Message to be sent:"}</p>
                  <p className="whitespace-pre-line break-words rounded-lg bg-page px-3 py-2 text-sm">{coursesMessage}</p>
                  <a href={whatsappUrl(coursesMessage)} target="_blank" rel="noopener noreferrer" onClick={() => afterSend()} className={sendCls}>
                    {waIcon}
                    {fr ? "Envoyer sur WhatsApp" : "Send on WhatsApp"}
                  </a>
                  <button type="button" onClick={() => setView("menu")} className={`${ghostCls} w-full`}>
                    {fr ? "Annuler" : "Cancel"}
                  </button>
                </div>
              )}

              {view === "pick" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="search"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={fr ? "Rechercher un produit" : "Search a product"}
                    aria-label={fr ? "Rechercher un produit" : "Search a product"}
                    className={fieldCls}
                  />

                  {products.isLoading && (
                    <div role="status" aria-live="polite">
                      <p className="px-2 pt-2 text-center text-sm font-medium text-muted">
                        {fr ? "Patientez, chargement des produits…" : "Please wait, loading products…"}
                      </p>
                      <ul className="mt-2 space-y-1" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <li key={n} className="flex animate-pulse items-center gap-3 px-2 py-2">
                            <span className="h-5 w-5 shrink-0 rounded bg-line/70" />
                            <span className="h-12 w-12 shrink-0 rounded-md bg-line/70" />
                            <span className="flex-1 space-y-2">
                              <span className="block h-3 w-3/4 rounded bg-line/70" />
                              <span className="block h-3 w-1/3 rounded bg-line/70" />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searching && <p className="px-2 text-center text-xs text-muted" role="status">{fr ? "Recherche…" : "Searching…"}</p>}
                  {products.isError && <p className="px-2 py-4 text-center text-sm text-danger">{fr ? "Impossible de charger les produits." : "Could not load products."}</p>}
                  {products.data && products.data.length === 0 && (
                    <p className="px-2 py-4 text-center text-sm text-muted">{fr ? "Aucun produit trouvé." : "No product found."}</p>
                  )}

                  <ul className={`transition-opacity ${searching ? "opacity-60" : ""}`}>
                    {(products.data ?? []).map((p) => {
                      const item: Picked = { name: p.name, url: p.share_url ?? `${window.location.origin}/boutique/${p.slug}` }
                      const on = picked.some((x) => x.url === item.url)
                      const img = p.image_url ?? p.images?.[0] ?? null
                      return (
                        <li key={p.id}>
                          <label className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-page ${on ? "bg-[#25D366]/10" : ""}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(item)} className="h-5 w-5 shrink-0 accent-[#25D366]" />
                            <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-line/60 text-sm font-bold text-muted">
                              {p.name.trim().charAt(0).toUpperCase()}
                              {img && (
                                <img
                                  src={img}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  width={48}
                                  height={48}
                                  onError={(e) => { e.currentTarget.style.display = "none" }}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 block text-sm font-medium">{p.name}</span>
                              <span className="block text-xs font-semibold text-primary">{formatPrice(p.price)}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {view === "review" && (
                <div className="space-y-3 p-1">
                  <ul className="space-y-1">
                    {picked.map((p) => (
                      <li key={p.url} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2 text-sm">
                        <span className="line-clamp-2 font-medium">{p.name}</span>
                        <button type="button" aria-label={fr ? "Retirer" : "Remove"} onClick={() => toggle(p)} className="grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-danger">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  {picked.length === 0 && (
                    <p className="px-2 text-center text-sm text-muted">{fr ? "Aucun produit choisi. Revenez à la liste." : "No product chosen. Go back to the list."}</p>
                  )}
                  {noteField}
                  {contactFields}
                  <p className="text-xs font-semibold text-muted">{fr ? "Message qui sera envoyé :" : "Message to be sent:"}</p>
                  <p className="max-h-32 overflow-y-auto whitespace-pre-line break-words rounded-lg bg-page px-3 py-2 text-xs">{productsMessage}</p>
                </div>
              )}

              {view === "ask" && intent && (
                <div className="space-y-3 p-1">
                  <ul className="max-h-28 space-y-1 overflow-y-auto">
                    {askLines.map((l, i) => (
                      <li key={i} className="rounded-lg bg-page px-3 py-2 text-sm font-medium">{l}</li>
                    ))}
                  </ul>
                  {noteField}
                  {contactFields}
                  <p className="text-xs font-semibold text-muted">{fr ? "Message qui sera envoyé :" : "Message to be sent:"}</p>
                  <p className="max-h-32 overflow-y-auto whitespace-pre-line break-words rounded-lg bg-page px-3 py-2 text-xs">{askMessage}</p>
                </div>
              )}
            </div>

            {view === "pick" && (
              <div className="border-t border-line p-2">
                <button
                  type="button"
                  disabled={picked.length === 0}
                  onClick={() => setView("review")}
                  className={`${sendCls} disabled:pointer-events-none disabled:opacity-50`}
                >
                  {fr ? `Continuer (${picked.length})` : `Continue (${picked.length})`}
                </button>
              </div>
            )}
            {view === "review" && picked.length > 0 && (
              <div className="border-t border-line p-2">
                <a
                  href={whatsappUrl(productsMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => afterSend(() => setPicked([]))}
                  className={sendCls}
                >
                  {waIcon}
                  {fr ? "Envoyer sur WhatsApp" : "Send on WhatsApp"}
                </a>
              </div>
            )}
            {view === "ask" && intent && (
              <div className="border-t border-line p-2">
                <a href={whatsappUrl(askMessage)} target="_blank" rel="noopener noreferrer" onClick={() => afterSend()} className={sendCls}>
                  {waIcon}
                  {fr ? "Envoyer sur WhatsApp" : "Send on WhatsApp"}
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {!hideFab && (
        <button
          type="button"
          aria-label={fr ? "Écrire sur WhatsApp" : "Chat on WhatsApp"}
          aria-expanded={open}
          onPointerEnter={() => { wake(); prefetch() }}
          onPointerDown={prefetch}
          onClick={() => {
            // Replie : le premier toucher le redeploie, le suivant ouvre le menu
            if (asleep) wake()
            else if (open) closeAll()
            else { setView("menu"); setIntent(null); setOpen(true) }
          }}
          className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-50 flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-white shadow-card-lg ring-1 ring-black/5 transition-all duration-500 ease-out active:scale-95 md:bottom-6 md:right-6 ${
            asleep ? "translate-x-[calc(100%-1.75rem)] bg-[#25D366]/60 opacity-70 backdrop-blur-md" : "translate-x-0 opacity-100"
          }`}
        >
          {waIcon}
          <span className="whitespace-nowrap text-sm font-semibold">{fr ? "Une question ?" : "Any question?"}</span>
        </button>
      )}
    </>
  )
}