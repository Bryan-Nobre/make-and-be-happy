import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderItem, OrderItemAddon, Product } from "@/data/types";
import { brl, uid } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useArvon } from "@/store/arvon";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — ARVON FOOD" },
      { name: "description", content: "Ponto de venda para pedidos de balcão e mesas." },
      { property: "og:title", content: "PDV — ARVON FOOD" },
      { property: "og:description", content: "Ponto de venda para pedidos de balcão e mesas." },
    ],
  }),
  component: () => (
    <AppLayout module="pdv">
      <Pdv />
    </AppLayout>
  ),
});

const itemTotal = (i: OrderItem) =>
  i.quantity * (i.unitPrice + i.addons.reduce((a, b) => a + b.price, 0));

function Pdv() {
  const { products, categories, addonGroups, tables, createOrder, payOrder, cash } = useArvon();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<number | "">("");
  const [tableId, setTableId] = useState<string>("");
  const [picking, setPicking] = useState<Product | null>(null);
  const [paying, setPaying] = useState(false);

  const list = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active &&
          (cat === "all" || p.categoryId === cat) &&
          (p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())),
      ),
    [products, cat, q],
  );
  const subtotal = cart.reduce((s, i) => s + itemTotal(i), 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const openTables = tables.filter((t) => t.status === "OCUPADA");

  const add = (p: Product, addons: OrderItemAddon[] = [], note = "") =>
    setCart((c) => [
      ...c,
      { id: uid("i"), productId: p.id, name: p.name, quantity: 1, unitPrice: p.price, addons, note },
    ]);

  const pick = (p: Product) => (p.addonGroupIds.length ? setPicking(p) : add(p));

  const reset = () => {
    setCart([]);
    setDiscount("");
    setTableId("");
  };

  const send = () => {
    const t = tables.find((x) => x.id === tableId);
    createOrder({
      origin: t ? "MESA" : "PDV",
      tableId: t?.id,
      tabNumber: t?.tabNumber,
      items: cart,
      discount: Number(discount || 0),
      surcharge: 0,
    });
    toast.success(t ? `Pedido lançado na ${t.name}.` : "Pedido enviado para a cozinha.");
    reset();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="PDV" description="Monte o pedido e envie para a cozinha ou receba na hora." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input className="h-11 pl-9" placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: "all", name: "Todos" }, ...categories.filter((c) => c.active).sort((a, b) => a.order - b.order)].map((c) => (
              <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "outline"} onClick={() => setCat(c.id)}>
                {c.name}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex min-h-24 flex-col justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary"
              >
                <span className="text-sm font-medium leading-snug">{p.name}</span>
                <span className="mt-2 text-sm font-semibold text-primary tabular-nums">{brl(p.price)}</span>
              </button>
            ))}
          </div>
          {list.length === 0 && <EmptyState icon={Search} title="Nenhum produto" description="Ajuste a busca ou a categoria." />}
        </div>

        <aside className="flex flex-col rounded-lg border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="border-b p-4">
            <h2 className="font-semibold">Pedido atual</h2>
            <Label htmlFor="mesa" className="mt-3 block text-xs text-muted-foreground">Destino</Label>
            <select
              id="mesa"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Balcão</option>
              {openTables.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · Comanda {t.tabNumber}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Carrinho vazio" description="Toque em um produto para adicionar." />
            ) : (
              <ul className="space-y-3">
                {cart.map((i) => (
                  <li key={i.id} className="rounded-md border p-2.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{i.name}</span>
                      <span className="tabular-nums">{brl(itemTotal(i))}</span>
                    </div>
                    {i.addons.length > 0 && <p className="text-xs text-muted-foreground">+ {i.addons.map((a) => a.name).join(", ")}</p>}
                    {i.note && <p className="text-xs text-muted-foreground italic">{i.note}</p>}
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => setCart((c) => c.map((x) => x.id === i.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} aria-label="Diminuir"><Minus className="size-3.5" /></Button>
                      <span className="w-8 text-center tabular-nums">{i.quantity}</span>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => setCart((c) => c.map((x) => x.id === i.id ? { ...x, quantity: x.quantity + 1 } : x))} aria-label="Aumentar"><Plus className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={() => setCart((c) => c.filter((x) => x.id !== i.id))} aria-label="Remover"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3 border-t p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <Label htmlFor="desc">Desconto</Label>
              <div className="w-28"><MoneyInput id="desc" value={discount} onChange={setDiscount} /></div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="tabular-nums">{brl(total)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" disabled={!cart.length} onClick={send}>Enviar</Button>
              <Button className="h-11" disabled={!cart.length || !!tableId} onClick={() => {
                if (cash.status !== "OPEN") return toast.error("Abra o caixa antes de receber pagamentos.");
                setPaying(true);
              }}>Receber</Button>
            </div>
          </div>
        </aside>
      </div>

      <AddonDialog
        product={picking}
        groups={addonGroups.filter((g) => picking?.addonGroupIds.includes(g.id))}
        onClose={() => setPicking(null)}
        onAdd={(addons, note) => {
          if (picking) add(picking, addons, note);
          setPicking(null);
        }}
      />
      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        total={total}
        onConfirm={(p) => {
          const o = createOrder({ origin: "PDV", items: cart, discount: Number(discount || 0), surcharge: 0 });
          setTimeout(() => payOrder(o.id, [p]), 0);
          toast.success(p.change ? `Venda concluída. Troco: ${brl(p.change)}` : "Venda concluída.");
          setPaying(false);
          reset();
        }}
      />
    </div>
  );
}

function AddonDialog({
  product,
  groups,
  onClose,
  onAdd,
}: {
  product: Product | null;
  groups: ReturnType<typeof useArvon>["addonGroups"];
  onClose: () => void;
  onAdd: (a: OrderItemAddon[], note: string) => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const toggle = (gid: string, oid: string, max: number) =>
    setSel((s) => {
      const cur = s[gid] ?? [];
      if (cur.includes(oid)) return { ...s, [gid]: cur.filter((x) => x !== oid) };
      if (cur.length >= max) return max === 1 ? { ...s, [gid]: [oid] } : s;
      return { ...s, [gid]: [...cur, oid] };
    });
  const confirm = () => {
    const missing = groups.find((g) => g.required && (sel[g.id]?.length ?? 0) < Math.max(1, g.min));
    if (missing) return toast.error(`Escolha uma opção em "${missing.name}".`);
    const addons = groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)).map((o) => ({ name: o.name, price: o.price })));
    onAdd(addons, note);
    setSel({});
    setNote("");
  };
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product?.name}</DialogTitle></DialogHeader>
        {groups.map((g) => (
          <fieldset key={g.id} className="space-y-2">
            <legend className="text-sm font-semibold">
              {g.name} <span className="font-normal text-muted-foreground">{g.required ? "(obrigatório)" : `(até ${g.max})`}</span>
            </legend>
            {g.options.map((o) => {
              const on = sel[g.id]?.includes(o.id) ?? false;
              return (
                <label key={o.id} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm", on && "border-primary bg-primary-soft")}>
                  <Checkbox checked={on} onCheckedChange={() => toggle(g.id, o.id, g.max)} />
                  <span className="flex-1">{o.name}</span>
                  {o.price > 0 && <span className="tabular-nums text-muted-foreground">+ {brl(o.price)}</span>}
                </label>
              );
            })}
          </fieldset>
        ))}
        <div className="space-y-1">
          <Label htmlFor="obs">Observação</Label>
          <Textarea id="obs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sem cebola" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
