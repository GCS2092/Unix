import type { User } from "../types"
import { canAccessSpace } from "./adminPaths"

export type StepSide = "top" | "right" | "bottom" | "left" | "auto" | "sidebar"

export interface TourStepDef {
  id: string
  /** selecteur CSS ; sans selecteur, l'etape est centree a l'ecran */
  sel?: string
  side?: StepSide
  /** cle i18n personnalisee (sinon tour.<tourId>.<stepId>) */
  k?: string
}

export interface TourDef {
  id: string
  /** a incrementer pour reafficher la visite de cette page a tout le monde */
  version: number
  /** true = jamais lancee automatiquement (seulement via le bouton "?") */
  manual?: boolean
  steps: TourStepDef[]
}

const at = (...names: string[]) => names.map((n) => `[data-tour="${n}"]`).join(",")
const c = (id: string): TourStepDef => ({ id })
const s = (id: string, ...names: string[]): TourStepDef => ({ id, sel: at(...names) })
const nv = (id: string, ...names: string[]): TourStepDef => ({ id, sel: at(...names), side: "auto" })
const nav = (id: string): TourStepDef => ({ id: `nav_${id}`, sel: at(`admin-${id}`), side: "sidebar", k: `tour.nav.${id}` })
// Etapes definies dans tour2.<ns>.<id> (sans repere = bulle centree)
const x = (ns: string, id: string, ...names: string[]): TourStepDef => ({
  id,
  sel: names.length ? at(...names) : undefined,
  k: `tour2.${ns}.${id}`,
})
const mk = (id: string, steps: TourStepDef[], manual = false): TourDef => ({ id, version: 1, manual, steps })

const ORDER_STEPS: TourStepDef[] = [
  x("order_detail", "intro"),
  x("order_detail", "hero", "od-hero"),
  x("order_detail", "timeline", "od-timeline"),
  x("order_detail", "items", "od-items"),
  x("order_detail", "actions", "od-actions"),
]

export const TOURS: Record<string, TourDef> = {
  // ---- Boutique (visiteur / client) ----
  home: mk("home", [
    c("welcome"), s("hero", "hero"), s("trust", "trust"), s("new", "new"),
    nv("cart", "nav-cart"), nv("whatsapp", "whatsapp"), s("track", "track"), nv("help", "help"),
  ]),
  shop: mk("shop", [s("search", "search"), s("filters", "filters"), s("card", "product-card"), nv("cart", "nav-cart")]),
  product: mk("product", [c("intro"), s("gallery", "pd-gallery"), s("buy", "pd-buy", "pd-buy-bar"), s("desc", "pd-desc")]),
  cart: mk("cart", [
    s("list", "cart-list"), s("qty", "cart-qty"), s("remove", "cart-remove"),
    s("summary", "cart-summary", "cart-summary-m"), s("checkout", "cart-checkout", "cart-checkout-m"), s("clear", "cart-clear"),
  ]),
  checkout: mk("checkout", [
    x("checkout", "intro"), x("checkout", "stepper", "co-stepper"), x("checkout", "step", "co-step"), x("checkout", "total", "co-total"),
  ], true),
  orders: mk("orders", [x("orders", "intro"), x("orders", "list", "or-list"), x("orders", "details", "or-details")]),
  order_detail: mk("order_detail", ORDER_STEPS),
  account: mk("account", [x("account", "intro"), x("account", "tabs", "ac-tabs"), x("account", "content", "ac-content"), x("account", "links", "ac-links")]),
  track: mk("track", [s("ref", "tr-ref"), s("paste", "tr-paste"), s("email", "tr-email")]),
  track_order: mk("track_order", ORDER_STEPS, true),

  // ---- Etudiant ----
  student_home: mk("student_home", [
    c("welcome"), s("stats", "st-stats"), s("resume", "st-resume"), s("live", "st-live"),
    nv("catalog", "st-catalog"), nv("meetings", "st-meetings"), nv("notifications", "st-notifications"), nv("help", "help"),
  ]),
  student_catalog: mk("student_catalog", [c("intro"), s("list", "co-list")]),
  student_meetings: mk("student_meetings", [
    x("student_meetings", "intro"), x("student_meetings", "live", "mt-live"),
    x("student_meetings", "upcoming", "mt-upcoming"), x("student_meetings", "invites", "mt-invites"),
  ]),
  student_notifications: mk("student_notifications", [
    x("student_notifications", "intro"), x("student_notifications", "readall", "no-readall"), x("student_notifications", "list", "no-list"),
  ]),

  // ---- Admin boutique ----
  admin_shop_dashboard: mk("admin_shop_dashboard", [
    c("welcome"), x("admin_shop_dashboard", "range", "dash-range"), s("kpi", "dash-kpi"), s("card", "dash-card"),
    nav("switch"), nav("overview"), nav("orders"), nav("products"), nav("stock"), nav("invoices"), nav("settings"), nav("account"),
  ]),
  admin_shop_overview: mk("admin_shop_overview", [
    x("admin_shop_overview", "intro"), x("admin_shop_overview", "range", "ov-range"), x("admin_shop_overview", "actions", "ov-actions"),
    x("admin_shop_overview", "todo", "ov-todo"), x("admin_shop_overview", "kpi", "ov-kpi"), x("admin_shop_overview", "section", "ov-section"),
  ]),
  admin_shop_orders: mk("admin_shop_orders", [
    x("admin_shop_orders", "intro"), x("admin_shop_orders", "chips", "ord-chips"), x("admin_shop_orders", "search", "ord-search"),
    x("admin_shop_orders", "export", "ord-export"), x("admin_shop_orders", "list", "ord-list"), x("admin_shop_orders", "select", "ord-select"),
    x("admin_shop_orders", "details", "ord-details"), x("admin_shop_orders", "next", "ord-next"), x("admin_shop_orders", "markpaid", "ord-markpaid"),
  ]),
  admin_shop_products: mk("admin_shop_products", [
    x("admin_shop_products", "intro"), x("admin_shop_products", "add", "pr-add"), x("admin_shop_products", "list", "pr-list"),
    x("admin_shop_products", "edit", "pr-edit"), x("admin_shop_products", "form", "pr-form"),
  ]),
  admin_shop_stock: mk("admin_shop_stock", [
    x("admin_shop_stock", "intro"), x("admin_shop_stock", "kpi", "sk-kpi"), x("admin_shop_stock", "tabs", "sk-tabs"),
    x("admin_shop_stock", "search", "sk-search"), x("admin_shop_stock", "filters", "sk-filters"), x("admin_shop_stock", "actions", "sk-actions"),
  ]),
  admin_shop_invoices: mk("admin_shop_invoices", [
    x("admin_shop_invoices", "intro"), x("admin_shop_invoices", "kpi", "iv-kpi"), x("admin_shop_invoices", "filters", "iv-filters"),
    x("admin_shop_invoices", "zip", "iv-zip"), x("admin_shop_invoices", "table", "iv-table"),
  ]),
  admin_shop_manual: mk("admin_shop_manual", [
    { id: "intro", k: "tour3.manual.intro" },
    { id: "customer", sel: at("mo-customer"), k: "tour3.manual.customer" },
    { id: "products", sel: at("mo-products"), k: "tour3.manual.products" },
    { id: "delivery", sel: at("mo-delivery"), k: "tour3.manual.delivery" },
    { id: "payment", sel: at("mo-payment"), k: "tour3.manual.payment" },
    { id: "total", sel: at("mo-total"), k: "tour3.manual.total" },
  ]),
  admin_shop_customers: mk("admin_shop_customers", [
    { id: "intro", k: "tour3.customers.intro" },
    { id: "search", sel: at("cu-search"), k: "tour3.customers.search" },
    { id: "list", sel: at("cu-list"), k: "tour3.customers.list" },
    { id: "export", sel: at("cu-export"), k: "tour3.customers.export" },
  ]),
  admin_shop_settings: {
    ...mk("admin_shop_settings", [
      x("admin_shop_settings", "intro"),
      { ...x("admin_shop_settings", "nav", "set-nav", "set-nav-m"), side: "auto" },
      { ...x("admin_shop_settings", "preview", "set-preview"), side: "auto" },
      s("fees", "set-fees", "set-fees-m"),
      s("comm", "set-comm", "set-comm-m"),
      { ...x("admin_shop_settings", "banners", "set-banners"), side: "auto" },
      { ...x("admin_shop_settings", "bannerswitch", "set-banner-switch"), side: "auto" },
      { ...x("admin_shop_settings", "gallery", "set-gallery"), side: "auto" },
      { ...x("admin_shop_settings", "eye", "set-eye"), side: "auto" },
      x("admin_shop_settings", "save"),
    ]),
    version: 2,
  },

  // ---- Admin formation ----
  admin_formation_dashboard: mk("admin_formation_dashboard", [
    c("welcome"), x("admin_formation_dashboard", "add", "fm-add"), x("admin_formation_dashboard", "enroll", "fm-enroll"),
    x("admin_formation_dashboard", "kpi", "fm-kpi"),
    nav("switch"), nav("courses"), nav("live"), nav("sessions"), nav("enrollments"), nav("account"),
  ]),
  admin_formation_courses: mk("admin_formation_courses", [
    x("admin_formation_courses", "intro"), x("admin_formation_courses", "add", "cs-add"),
    x("admin_formation_courses", "table", "cs-table"), x("admin_formation_courses", "form", "cs-form"),
  ]),
  admin_formation_live: mk("admin_formation_live", [
    s("course", "live-course"), s("controls", "live-controls"), s("share", "live-share"),
    s("meeting", "live-meeting"), s("admission", "live-admission"), s("invite", "live-invite"),
  ]),
  admin_formation_sessions: mk("admin_formation_sessions", [
    x("admin_formation_sessions", "intro"), x("admin_formation_sessions", "form", "se-form"), x("admin_formation_sessions", "when", "se-when"),
    x("admin_formation_sessions", "notify", "se-notify"), x("admin_formation_sessions", "list", "se-list"),
  ]),
  admin_formation_enrollments: mk("admin_formation_enrollments", [
    x("admin_formation_enrollments", "intro"), x("admin_formation_enrollments", "search", "en-search"),
    x("admin_formation_enrollments", "status", "en-status"), x("admin_formation_enrollments", "table", "en-table"),
  ]),

  // ---- Pages ajoutees ----
  admin_shop_payments: mk("admin_shop_payments", [
    x("admin_shop_payments", "intro"), x("admin_shop_payments", "kpi", "pay-kpi"), x("admin_shop_payments", "tabs", "pay-tabs"),
    x("admin_shop_payments", "search", "pay-search"), x("admin_shop_payments", "list", "pay-list"),
  ]),
  admin_faq: mk("admin_faq", [x("admin_faq", "intro"), x("admin_faq", "add", "faq-add"), x("admin_faq", "list", "faq-list")]),
  admin_formation_requests: mk("admin_formation_requests", [
    x("admin_formation_requests", "intro"), x("admin_formation_requests", "filters", "rq-filters"),
    x("admin_formation_requests", "tabs", "rq-tabs"), x("admin_formation_requests", "list", "rq-list"),
  ]),
  admin_formation_certificates: mk("admin_formation_certificates", [
    x("admin_formation_certificates", "intro"), x("admin_formation_certificates", "views", "cert-views"),
    x("admin_formation_certificates", "filters", "cert-filters"), x("admin_formation_certificates", "tiles", "cert-tiles"),
    x("admin_formation_certificates", "list", "cert-list"),
  ]),
  admin_formation_share: mk("admin_formation_share", [
    x("admin_formation_share", "intro"), x("admin_formation_share", "base", "share-base"),
    x("admin_formation_share", "general", "share-general"), x("admin_formation_share", "course", "share-course"),
  ]),
  admin_system_presentation: mk("admin_system_presentation", [
    x("admin_system_presentation", "intro"), x("admin_system_presentation", "tabs", "pres-tabs"),
    x("admin_system_presentation", "images"), x("admin_system_presentation", "save"),
  ]),

  // ---- Admin systeme ----
  admin_system_users: mk("admin_system_users", [
    x("admin_system_users", "intro"), x("admin_system_users", "search", "us-search"), x("admin_system_users", "table", "us-table"),
    nav("activity"), nav("account"),
  ]),
  admin_system_activity: mk("admin_system_activity", [
    x("admin_system_activity", "intro"), x("admin_system_activity", "search", "lg-search"), x("admin_system_activity", "table", "lg-table"),
  ]),
}

const ADMIN_PAGES: Record<string, string> = {
  "boutique/tableau-de-bord": "admin_shop_dashboard",
  "boutique/apercu": "admin_shop_overview",
  "boutique/commandes": "admin_shop_orders",
  "boutique/produits": "admin_shop_products",
  "boutique/stock": "admin_shop_stock",
  "boutique/factures": "admin_shop_invoices",
  "boutique/parametres": "admin_shop_settings",
  "boutique/commandes/nouvelle": "admin_shop_manual",
  "boutique/clients": "admin_shop_customers",
  "formation/tableau-de-bord": "admin_formation_dashboard",
  "formation/cours": "admin_formation_courses",
  "formation/direct": "admin_formation_live",
  "formation/seances": "admin_formation_sessions",
  "formation/inscriptions": "admin_formation_enrollments",
  "systeme/utilisateurs": "admin_system_users",
  "systeme/journal": "admin_system_activity",
  "boutique/paiements": "admin_shop_payments",
  "boutique/faq": "admin_faq",
  "formation/faq": "admin_faq",
  "formation/demandes": "admin_formation_requests",
  "formation/certificats": "admin_formation_certificates",
  "formation/liens": "admin_formation_share",
  "systeme/presentation": "admin_system_presentation",
}

const STUDENT_PAGES: Record<string, string> = {
  "/etudiant": "student_home",
  "/etudiant/catalogue": "student_catalog",
  "/etudiant/reunions": "student_meetings",
  "/etudiant/notifications": "student_notifications",
}

const seenKey = (t: TourDef) => `unix:tour:${t.id}:v${t.version}`
const OFF_KEY = "unix:tour:off"

export function hasSeen(t: TourDef): boolean {
  try {
    return localStorage.getItem(seenKey(t)) !== null
  } catch {
    return true // stockage indisponible : on ne harcele pas l'utilisateur
  }
}

export function markSeen(t: TourDef) {
  try {
    localStorage.setItem(seenKey(t), String(Date.now()))
  } catch {
    /* stockage indisponible */
  }
}

/** Desactive le declenchement automatique (le bouton d'aide continue de fonctionner) */
export function autoDisabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== null
  } catch {
    return true
  }
}

export function disableAuto() {
  try {
    localStorage.setItem(OFF_KEY, "1")
  } catch {
    /* stockage indisponible */
  }
}

/** Quelle visite correspond a cette page ? null = aucune (connexion, direct, cours...) */
export function resolveTour(pathname: string, user: User | null): TourDef | null {
  const p = pathname.replace(/\/+$/, "") || "/"

  const adm = p.match(/^\/admin\/(boutique|formation|systeme)\/([^/]+(?:\/nouvelle)?)$/)
  if (adm) {
    const space = adm[1] === "boutique" ? "shop" : adm[1] === "formation" ? "formation" : "system"
    if (!canAccessSpace(user, space)) return null
    const id = ADMIN_PAGES[`${adm[1]}/${adm[2]}`]
    return id ? TOURS[id] : null
  }

  if (p.startsWith("/etudiant")) {
    const id = STUDENT_PAGES[p]
    return id && user && (user.is_student || user.is_admin) ? TOURS[id] : null
  }

  if (user?.is_admin) return null // les admins sont renvoyes vers /admin

  if (p === "/") return TOURS.home
  if (p === "/boutique") return TOURS.shop
  if (/^\/boutique\/[^/]+$/.test(p)) return TOURS.product
  if (p === "/panier") return TOURS.cart
  if (p === "/commande") return TOURS.checkout
  if (p === "/suivi") return TOURS.track
  if (/^\/suivi\/[^/]+$/.test(p)) return TOURS.track_order
  if (p === "/commandes") return user ? TOURS.orders : null
  if (/^\/commandes\/[^/]+$/.test(p)) return user ? TOURS.order_detail : null
  if (p === "/compte") return user ? TOURS.account : null
  return null
}

