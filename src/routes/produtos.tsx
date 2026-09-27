import { createFileRoute } from "@tanstack/react-router";
import { Copy, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Product, Sector } from "@/data/types";
import { brl, uid } from "@/lib/format";
import { useArvon } from "@/store/arvon";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — ARVON FOOD" },
      { name: "description", content: "Cardápio, categorias e grupos de adicionais." },
      { property: "og:title", content: "Produtos — ARVON FOOD" },
      { property: "og:description", content: "Cardápio, categorias e grupos de adicionais." },
    ],
  }),
  component: () => (
    <AppLayout module="produtos">
      <Produtos />
    </AppLayout>
  ),
});

const SECTORS: Sector[] = ["COZINHA", "BAR", "PIZZA", "CHAPA"];

function Produtos() {
  const { products, categories, addonGroups, toggleProduct, duplicateProduct, saveProduct, saveCategory, toggleCategory } = useArvon();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const [newCat, setNewCat] = useState("");
  const list = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));

  const blank = (): Product => ({ id: uid("p"), name: "", categoryId: categories[0]?.id ?? "", description: "", price: 0, code: "", active: true, sector: "COZINHA", addonGroupIds: [] });

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Gerencie o cardápio." actions={<Button onClick={() => setEdit(blank())}><Plus className="size-4" />Novo produto</Button>} />
      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="space-y-3">
          <Input className="h-11 max-w-sm" placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr><th className="p-3">Código</th><th className="p-3">Nome</th><th className="p-3">Categoria</th><th className="p-3">Setor</th><th className="p-3 text-right">Preço</th><th className="p-3">Ativo</th><th className="p-3" /></tr>
              </thead>
              <tbody className="divide-y">
                {list.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                    <td className="p-3 text-muted-foreground">{p.code}</td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{categories.find((c) => c.id === p.categoryId)?.name}</td>
                    <td className="p-3">{p.sector}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.price)}</td>
                    <td className="p-3"><Switch checked={p.active} onCheckedChange={() => toggleProduct(p.id)} aria-label="Ativar produto" /></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEdit(p)} aria-label="Editar"><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { duplicateProduct(p.id); toast.success("Produto duplicado (inativo)."); }} aria-label="Duplicar"><Copy className="size-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="categorias" className="space-y-3">
          <div className="flex max-w-md gap-2">
            <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button onClick={() => { if (!newCat.trim()) return; saveCategory({ id: uid("c"), name: newCat, active: true, order: categories.length + 1 }); setNewCat(""); }}>Adicionar</Button>
          </div>
          <ul className="divide-y rounded-lg border bg-card">
            {[...categories].sort((a, b) => a.order - b.order).map((c) => (
              <li key={c.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  {products.filter((p) => p.categoryId === c.id).length} produtos
                  <Switch checked={c.active} onCheckedChange={() => toggleCategory(c.id)} aria-label="Ativar categoria" />
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="adicionais">
          <div className="grid gap-3 md:grid-cols-2">
            {addonGroups.map((g) => (
              <div key={g.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{g.name}</h3>
                  <StatusBadge tone={g.required ? "warning" : "neutral"}>{g.required ? "Obrigatório" : "Opcional"} · {g.min}–{g.max}</StatusBadge>
                </div>
                <ul className="mt-2 text-sm">
                  {g.options.map((o) => <li key={o.id} className="flex justify-between py-0.5"><span>{o.name}</span><span className="tabular-nums text-muted-foreground">{brl(o.price)}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{products.some((p) => p.id === edit?.id) ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-1"><Label htmlFor="pn">Nome</Label><Input id="pn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label htmlFor="pc">Código</Label><Input id="pc" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
                <div className="grid gap-1"><Label htmlFor="pp">Preço</Label><MoneyInput id="pp" value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label htmlFor="pcat">Categoria</Label>
                  <select id="pcat" className="h-10 rounded-md border bg-background px-3 text-sm" value={edit.categoryId} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div className="grid gap-1"><Label htmlFor="ps">Setor</Label>
                  <select id="ps" className="h-10 rounded-md border bg-background px-3 text-sm" value={edit.sector} onChange={(e) => setEdit({ ...edit, sector: e.target.value as Sector })}>
                    {SECTORS.map((s) => <option key={s}>{s}</option>)}
                  </select></div>
              </div>
              <div className="grid gap-1"><Label htmlFor="pd">Descrição</Label><Textarea id="pd" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!edit || !edit.name.trim() || edit.price <= 0) return toast.error("Informe nome e preço maior que zero.");
              saveProduct(edit); toast.success("Produto salvo."); setEdit(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
