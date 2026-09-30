
export interface Product {
  image_url?: string | null
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  stock?: number
  name_en?: string | null
  image_link?: string | null
  description_en?: string | null
  is_published?: boolean
  created_at: string
  updated_at: string
}

export type CartItemType = "product"

export interface CartItem {
  type: CartItemType
  id: number
  title: string
  slug: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Cart {
  items: CartItem[]
  total: number
}

export interface User {
  id: number
  name: string
  email: string
  is_admin: boolean
  created_at: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface OrderItem {
  id: number
  quantity: number
  unit_price: number
  line_total: number
  item?: { type: "course" | "product"; id: number; title?: string; name?: string; slug: string } | null
}

export interface Order {
  subtotal?: number
  delivery_fee?: number
  delivery_method?: string | null
  delivery_zone?: string | null
  phone?: string | null
  city?: string | null
  district?: string | null
  address?: string | null
  landmark?: string | null
  note?: string | null
  id: number
  status: string
  status_label: string
  total: number
  currency: string
  paid_at: string | null
  items?: OrderItem[]
  created_at: string
  updated_at: string
}

export interface CheckoutResponse {
  data: Order
  payment_url: string | null
  payment_pending_manual?: boolean
  transaction_id: string
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  total: number
}

export interface ApiCollection<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ApiResource<T> {
  data: T
}

export interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}



export interface PaymentRetryResponse {
  payment_url: string
  transaction_id: string
}


export interface AdminOrder extends Order {
  guest_email?: string | null
  guest_name?: string | null
  user?: User | null
}
