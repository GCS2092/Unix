import type { User } from "../types"
import { adminScopeOf } from "./adminPaths"

export type AccountKind = "shop" | "formation" | "both"

/** Boutique seule : pas etudiant. Formation seule : etudiant sans aucune commande (has_shop = false). Sinon les deux. */
export function accountKind(u: User | null | undefined): AccountKind | null {
  if (!u) return null
  if (u.is_admin) {
    const s = adminScopeOf(u)
    return s === "formation" || s === "instructor" ? "formation" : s === "shop" ? "shop" : "both"
  }
  if (!u.is_student) return (u as { formation_signup?: boolean }).formation_signup === true ? "formation" : "shop"
  return (u as { has_shop?: boolean }).has_shop === false ? "formation" : "both"
}