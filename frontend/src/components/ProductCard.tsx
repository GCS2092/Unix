import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "./AddToCartButton"
import ProductImage from "./ProductImage"
import StockBadge from "./StockBadge"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Product } from "../types"

export default function ProductCard({ product }: { product: Product }) {
  const formatPrice = useFormatPrice()
  const queryClient = useQueryClient()
  const soldOut = typeof product.stock === "number" && product.stock <= 0
  const prefetch = () =>
    void queryClient.prefetchQuery({
      queryKey: ["product", product.slug],
      queryFn: async () => (await catalogApi.product(product.slug)).data.data,
      staleTime: 60_000,
    })

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-lg">
      <Link to={`/boutique/${product.slug}`} className="relative block overflow-hidden" onPointerEnter={prefetch} onTouchStart={prefetch}>
        <ProductImage
          src={product.image_url}
          alt={product.name}
          ratio="aspect-[4/3]"
          className={`transition duration-300 group-hover:scale-[1.03] ${soldOut ? "grayscale" : ""}`}
        />
        <StockBadge stock={product.stock} className="absolute left-2 top-2" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link to={`/boutique/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold hover:text-primary sm:text-base">
          {product.name}
        </Link>
        <p className="text-lg font-extrabold text-primary">{formatPrice(product.price)}</p>
        <div className="mt-auto pt-1">
          <AddToCartButton type="product" id={product.id} stock={product.stock} />
        </div>
      </div>
    </article>
  )
}