export interface NavItem {
  to: string
  labelKey: string
  access: "public" | "auth" | "student"
}

type Who = { is_student?: boolean; is_admin?: boolean; admin_scope?: string | null } | null

export const canSee = (l: NavItem, user: Who): boolean => {
  if (l.access === "public") return true
  if (!user) return false
  if (l.access === "student") return !!(user.is_student || (user.is_admin && (user.admin_scope ?? "super") !== "shop"))
  return true
}

// Espace BOUTIQUE (client)
export const shopLinks: NavItem[] = [
  { to: "/boutique", labelKey: "nav.shop", access: "public" },
  { to: "/panier", labelKey: "nav.cart", access: "public" },
  { to: "/commandes", labelKey: "nav.my_orders", access: "auth" },
]

// Espace FORMATION (etudiant uniquement)
export const learnLinks: NavItem[] = [
  
  { to: "/etudiant", labelKey: "learn.nav_my_courses", access: "student" },
]
