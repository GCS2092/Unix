import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "../../components/admin/ui"
import ExportButton from "../../components/admin/ExportButton"
import ResourceImportPanel from "../../components/admin/ResourceImportPanel"
import Button from "../../components/Button"
import ProductImportPanel from "./ProductImportPanel"

type Space = "shop" | "formation"

interface Item {
  key: string
  title: string
  hint: string
  importer?: "product" | "generic"
  dated?: boolean
}

const ITEMS: Record<Space, Item[]> = {
  shop: [
    { key: "products", title: "Produits", hint: "Catalogue complet, réimportable tel quel (création et mise à jour).", importer: "product" },
    { key: "categories", title: "Catégories", hint: "Nom, slug, position, état.", importer: "generic" },
    { key: "shipping-zones", title: "Zones de livraison", hint: "Codes, libellés, frais, pays.", importer: "generic" },
    { key: "faqs-shop", title: "FAQ boutique", hint: "Questions et réponses (français et anglais).", importer: "generic" },
    { key: "orders", title: "Commandes", hint: "Export seul (données comptables et personnelles).", dated: true },
    { key: "order-lines", title: "Lignes de commande", hint: "Un article par ligne, pour la comptabilité.", dated: true },
  ],
  formation: [
    { key: "courses", title: "Formations", hint: "Export seul pour le moment." },
    { key: "faqs-formation", title: "FAQ formation", hint: "Questions et réponses (français et anglais).", importer: "generic" },
  ],
}

const dateCls = "min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"

export default function AdminTransferPage({ space }: { space: Space }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<string, { from: string; to: string }>>({})

  const refresh = async () => {
    await queryClient.invalidateQueries()
  }

  function setDate(key: string, which: "from" | "to", value: string) {
    setDates((p) => ({ ...p, [key]: { from: p[key]?.from ?? "", to: p[key]?.to ?? "", [which]: value } }))
  }

  return (
    <div>
      <PageHeader
        title="Import / Export"
        subtitle="Exportez vos données en Excel, CSV ou JSON, et importez-les avec reconnaissance automatique des colonnes."
      />
      <ul className="space-y-3">
        {ITEMS[space].map((it) => {
          const d = dates[it.key]
          const params: Record<string, string> = {}
          if (d?.from) params.from = d.from
          if (d?.to) params.to = d.to
          return (
            <li key={it.key} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink">{it.title}</h2>
                  <p className="text-sm text-muted">{it.hint}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {it.dated && (
                    <>
                      <input type="date" aria-label="Du" className={dateCls} value={d?.from ?? ""} onChange={(e) => setDate(it.key, "from", e.target.value)} />
                      <input type="date" aria-label="Au" className={dateCls} value={d?.to ?? ""} onChange={(e) => setDate(it.key, "to", e.target.value)} />
                    </>
                  )}
                  <ExportButton resource={it.key} params={params} />
                  {it.importer && (
                    <Button variant="secondary" onClick={() => setOpen(open === it.key ? null : it.key)}>
                      {open === it.key ? "Masquer l'import" : "Importer"}
                    </Button>
                  )}
                </div>
              </div>
              {open === it.key && it.importer === "product" && <ProductImportPanel onDone={refresh} onClose={() => setOpen(null)} />}
              {open === it.key && it.importer === "generic" && (
                <ResourceImportPanel scope={space} resource={it.key} title={it.title} onDone={refresh} onClose={() => setOpen(null)} />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}