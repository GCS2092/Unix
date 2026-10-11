import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { adminApi, type CategoryRow } from "../../api/admin"
import { getErrorMessage } from "../../lib/errors"
import { toast } from "../../stores/toastStore"
import { ErrorState, LoadingState } from "../../components/States"
import Button from "../../components/Button"

const input =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
const KEY = ["admin-categories"]

function useRefresh() {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: KEY })
    await qc.invalidateQueries({ queryKey: ["categories"] })
    await qc.invalidateQueries({ queryKey: ["admin-products"] })
    await qc.invalidateQueries({ queryKey: ["products-inf"] })
  }
}

function Row({ cat }: { cat: CategoryRow }) {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const refresh = useRefresh()
  const [name, setName] = useState(cat.name)
  const [nameEn, setNameEn] = useState(cat.name_en ?? "")
  const [active, setActive] = useState(cat.is_active)

  const save = useMutation({
    mutationFn: () => adminApi.updateCategory(cat.id, { name: name.trim(), name_en: nameEn.trim() === "" ? null : nameEn.trim(), is_active: active }),
    onSuccess: async () => { toast.success(fr ? "Catégorie enregistrée" : "Category saved"); await refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => adminApi.deleteCategory(cat.id),
    onSuccess: async () => { toast.success(fr ? "Catégorie supprimée" : "Category deleted"); await refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <li className="space-y-3 rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{cat.slug} · {fr ? `${cat.products_count} produit(s)` : `${cat.products_count} product(s)`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium">{fr ? "Nom (français)" : "Name (French)"}</span>
          <input className={input} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Nom (anglais)" : "Name (English)"}</span>
          <input className={input} value={nameEn} maxLength={255} onChange={(e) => setNameEn(e.target.value)} /></label>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {fr ? "Visible dans la boutique" : "Visible in the shop"}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate()}>{fr ? "Enregistrer" : "Save"}</Button>
        <Button variant="secondary" loading={remove.isPending}
          onClick={() => { if (window.confirm(fr ? "Supprimer cette catégorie ? Ses produits passeront sans catégorie." : "Delete this category? Its products will become uncategorised.")) remove.mutate() }}>
          {fr ? "Supprimer" : "Delete"}
        </Button>
      </div>
    </li>
  )
}

function NewCategory() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const refresh = useRefresh()
  const [name, setName] = useState("")
  const [nameEn, setNameEn] = useState("")

  const create = useMutation({
    mutationFn: () => adminApi.createCategory({ name: name.trim(), name_en: nameEn.trim() === "" ? null : nameEn.trim() }),
    onSuccess: async () => { toast.success(fr ? "Catégorie ajoutée" : "Category added"); setName(""); setNameEn(""); await refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
      <h4 className="text-sm font-semibold">{fr ? "Ajouter une catégorie" : "Add a category"}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium">{fr ? "Nom (français)" : "Name (French)"}</span>
          <input className={input} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">{fr ? "Nom (anglais)" : "Name (English)"}</span>
          <input className={input} value={nameEn} maxLength={255} onChange={(e) => setNameEn(e.target.value)} /></label>
      </div>
      <Button loading={create.isPending} disabled={name.trim() === ""} onClick={() => create.mutate()}>{fr ? "Ajouter" : "Add"}</Button>
    </div>
  )
}

export default function CategoriesPanel() {
  const { i18n } = useTranslation()
  const fr = i18n.language.startsWith("fr")
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await adminApi.categories()).data.data,
    staleTime: 0,
  })

  return (
    <div className="mb-6 space-y-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-lg font-semibold">{fr ? "Catégories de produits" : "Product categories"}</h2>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <ul className="space-y-3">{data.map((c) => <Row key={`${c.id}-${c.name}-${c.is_active}`} cat={c} />)}</ul>
          <NewCategory />
        </>
      )}
    </div>
  )
}