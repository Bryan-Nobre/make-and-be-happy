import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StockItem, StockMovement } from "@/data/types";
import { dateTime } from "@/lib/format";
import { stockStatus, useArvon } from "@/store/arvon";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — ARVON FOOD" },
      { name: "description", content: "Controle de insumos, entradas, saídas e ajustes." },
      { property: "og:title", content: "Estoque — ARVON FOOD" },
      { property: "og:description", content: "Controle de insumos, entradas, saídas e ajustes." },
    ],
  }),
  component: () => (
    <AppLayout module="estoque">
      <Estoque />
    </AppLayout>
  ),
});

const ST = { NORMAL: { l: "Normal", t: "success" }, BAIXO: { l: "Baixo", t: "warning" }, SEM_ESTOQUE: { l: "Sem estoque", t: "danger" } } as const;
const TYPE_L = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" } as const;

function Estoque() {
  const { stock, stockMovements, moveStock } = useArvon();
  const [item, setItem] = useState<StockItem | null>(null);
  const [type, setType] = useState<StockMovement["type"]>("ENTRADA");
  const [qty, setQty] = useState<number | "">("");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!item || qty === "" || qty < 0 || !reason.trim()) return toast.error("Informe quantidade e motivo.");
    const r = moveStock({ itemId: item.id, type, quantity: Number(qty), reason });
    if (!r.ok) return toast.error(r.error);
    toast.success("Movimentação registrada.");
    setItem(null); setQty(""); setReason("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" description="Saldo dos insumos e histórico de movimentações." />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Itens cadastrados" value={String(stock.length)} />
        <KpiCard label="Estoque baixo" value={String(stock.filter((i) => stockStatus(i) === "BAIXO").length)} />
        <KpiCard label="Sem estoque" value={String(stock.filter((i) => stockStatus(i) === "SEM_ESTOQUE").length)} />
      </div>
      <Tabs defaultValue="itens">
        <TabsList><TabsTrigger value="itens">Itens</TabsTrigger><TabsTrigger value="mov">Movimentações</TabsTrigger></TabsList>
        <TabsContent value="itens">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Código</th><th className="p-3">Item</th><th className="p-3">Categoria</th><th className="p-3 text-right">Saldo</th><th className="p-3 text-right">Mínimo</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
              <tbody className="divide-y">
                {stock.map((i) => {
                  const s = ST[stockStatus(i)];
                  return (
                    <tr key={i.id}>
                      <td className="p-3 text-muted-foreground">{i.code}</td>
                      <td className="p-3 font-medium">{i.name}</td>
                      <td className="p-3">{i.category}</td>
                      <td className="p-3 text-right tabular-nums">{i.quantity} {i.unit}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{i.minimum} {i.unit}</td>
                      <td className="p-3"><StatusBadge tone={s.t}>{s.l}</StatusBadge></td>
                      <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => setItem(i)}>Movimentar</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="mov">
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {stockMovements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <StatusBadge tone={m.type === "ENTRADA" ? "success" : m.type === "SAIDA" ? "danger" : "info"}>{TYPE_L[m.type]}</StatusBadge>
                <span className="font-medium">{m.itemName}</span>
                <span className="tabular-nums">{m.quantity > 0 && m.type !== "SAIDA" ? "+" : m.type === "SAIDA" ? "−" : ""}{Math.abs(m.quantity)}</span>
                <span className="flex-1 text-muted-foreground">{m.reason}</span>
                <span className="text-xs text-muted-foreground">{m.user} · {dateTime(m.at)}</span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={!!item} onOpenChange={(o) => !o && setItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Movimentar: {item?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Saldo atual: {item?.quantity} {item?.unit}</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_L) as StockMovement["type"][]).map((t) => (
              <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>{TYPE_L[t]}</Button>
            ))}
          </div>
          <Label htmlFor="sq">{type === "AJUSTE" ? "Novo saldo" : "Quantidade"}</Label>
          <Input id="sq" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))} />
          <Label htmlFor="sr">Motivo</Label>
          <Input id="sr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: compra do fornecedor" />
          <DialogFooter><Button onClick={submit}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
