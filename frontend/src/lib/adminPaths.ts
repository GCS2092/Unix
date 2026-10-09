import type { User } from "../types"

export type AdminSpace = "shop" | "formation" | "system"
export type AdminScope = "super" | "shop" | "formation"
type Who = Pick<User, "is_admin" | "admin_scope"> | null | undefined

export const adminScopeOf = (u: Who): AdminScope | null =>
  u?.is_admin ? (u.admin_scope ?? "super") : null

export const canAccessSpace = (u: Who, space?: AdminSpace): boolean => {
  const s = adminScopeOf(u)
  if (!s) return false
  if (!space || s === "super") return true
  if (space === "system") return false
  return s === space
}

const SHOP = "/admin/boutique"
const FORMATION = "/admin/formation"
const SYSTEM = "/admin/systeme"

export const adminPaths = {
  shop: {
    base: SHOP,
    login: `${SHOP}/connexion`,
    dashboard: `${SHOP}/tableau-de-bord`,
    overview: `${SHOP}/apercu`,
    products: `${SHOP}/produits`,
    stock: `${SHOP}/stock`,
    invoices: `${SHOP}/factures`,
    orders: `${SHOP}/commandes`,
    settings: `${SHOP}/parametres`,
  },
  formation: {
    base: FORMATION,
    login: `${FORMATION}/connexion`,
    dashboard: `${FORMATION}/tableau-de-bord`,
    courses: `${FORMATION}/cours`,
    live: `${FORMATION}/direct`,
    sessions: `${FORMATION}/seances`,
    enrollments: `${FORMATION}/inscriptions`,
  },
  system: {
    base: SYSTEM,
    users: `${SYSTEM}/utilisateurs`,
    activity: `${SYSTEM}/journal`,
  },
}

export const adminHome = (u: Who): string =>
  adminScopeOf(u) === "formation" ? adminPaths.formation.dashboard : adminPaths.shop.dashboard

// Anciennes URL (/admin/produits ...) -> nouvelles
const LEGACY: Record<string, string> = {
  "tableau-de-bord": `${SHOP}/tableau-de-bord`,
  commandes: `${SHOP}/commandes`,
  produits: `${SHOP}/produits`,
  stock: `${SHOP}/stock`,
  apercu: `${SHOP}/apercu`,
  factures: `${SHOP}/factures`,
  parametres: `${SHOP}/parametres`,
  cours: `${FORMATION}/cours`,
  formations: `${FORMATION}/tableau-de-bord`,
  direct: `${FORMATION}/direct`,
  seances: `${FORMATION}/seances`,
  inscriptions: `${FORMATION}/inscriptions`,
  utilisateurs: `${SYSTEM}/utilisateurs`,
  journal: `${SYSTEM}/journal`,
}

export function legacyAdminPath(pathname: string, search = ""): string | null {
  const m = pathname.match(/^\/admin\/([^/]+)(\/.*)?$/)
  if (!m) return null
  const base = LEGACY[m[1]]
  return base ? `${base}${m[2] ?? ""}${search}` : null
}