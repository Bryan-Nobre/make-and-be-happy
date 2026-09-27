import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RestaurantTable } from "@/data/types";
import { brl, elapsed } from "@/lib/format";
import { ORDER_STATUS, TABLE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { orderTotal, useArvon } from "@/store/arvon";

export const Route = createFileRoute("/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas — ARVON FOOD" },
      { name: "description", content: "Mapa de mesas, comandas abertas e fechamento de conta." },
      { property: "og:title", content: "Mesas — ARVON FOOD" },
      { property: "og:description", content: "Mapa de mesas, comandas abertas e fechamento de conta." },
    ],
  }),
  component: () => (
    <AppLayout module="mesas">
      <Mesas />
    </AppLayout>
  ),
});

function Mesas() {
  const { tables, orders, company, openTable, requestClose, releaseTable, transferTable, payOrder, cash } = useArvon();
  const [selId, setSelId] = useState<string | null>(null);
  const [people, setPeople] = useState(2);
  const [paying, setPaying] = useState(false);
  const [target, setTarget] = useState("");
  const sel = tables.find((t) => t.id === selId) ?? null;
  const tabOrders = (t: RestaurantTable) =>
    orders.filter((o) => o.tableId === t.id && o.status !== "COMPLETED" && o.status !== "CANCELLED");
  const subtotal = sel ? tabOrders(sel).reduce((s, o) => s + orderTotal(o), 0) : 0;
  const fee = subtotal * (company.serviceFee / 100);
  const total = subtotal + fee;

  const counts = {
    LIVRE: tables.filter((t) => t.status === "LIVRE").length,
    OCUPADA: tables.filter((t) => t.status === "OCUPADA").length,
    AGUARDANDO_PAGAMENTO: tables.filter((t) => t.status === "AGUARDANDO_PAGAMENTO").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mesas" description="Toque em uma mesa para abrir, lançar pedidos ou fechar a conta." />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
          <StatusBadge key={k} tone={TABLE_STATUS[k].tone}>{TABLE_STATUS[k].label}: {counts[k]}</StatusBadge>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((t) => {
          const value = tabOrders(t).reduce((s, o) => s + orderTotal(o), 0);
          return (
            <button
              key={t.id}
              onClick={() => setSelId(t.id)}
              className={cn(
                "flex min-h-32 flex-col rounded-lg border-2 bg-card p-3 text-left transition-colors hover:border-primary",
                t.status === "OCUPADA" && "border-primary/40 bg-primary-soft",
                t.status === "AGUARDANDO_PAGAMENTO" && "border-warning/50 bg-warning-soft",
              )}
            >
              <span className="text-lg font-bold">{t.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" aria-hidden="true" />{t.people ?? 0}/{t.seats}</span>
              <span className="mt-auto pt-2">
                {t.status === "LIVRE" ? (
                  <span className="text-sm text-muted-foreground">Livre</span>
                ) : (
                  <>
                    <span className="block text-sm font-semibold tabular-nums">{brl(value)}</span>
                    <span className="block text-xs text-muted-foreground">Comanda {t.tabNumber} · {t.openedAt && elapsed(t.openedAt)}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.name}</SheetTitle>
                <StatusBadge tone={TABLE_STATUS[sel.status].tone} className="w-fit">{TABLE_STATUS[sel.status].label}</StatusBadge>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                {sel.status === "LIVRE" ? (
                  <div className="space-y-3">
                    <Label htmlFor="ppl">Número de pessoas</Label>
                    <Input id="ppl" type="number" min={1} max={sel.seats * 2} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
                    <Button className="h-11 w-full" onClick={() => { openTable(sel.id, people); toast.success(`${sel.name} aberta.`); }}>Abrir mesa</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Comanda {sel.tabNumber} · {sel.people} pessoas · aberta há {sel.openedAt && elapsed(sel.openedAt)}</p>
                    <ul className="divide-y rounded-md border">
                      {tabOrders(sel).length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum pedido lançado.</li>}
                      {tabOrders(sel).map((o) => (
                        <li key={o.id} className="p-3 text-sm">
                          <div className="flex justify-between"><span className="font-medium">#{o.number}</span><StatusBadge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusBadge></div>
                          {o.items.map((i) => <p key={i.id} className="text-muted-foreground">{i.quantity}× {i.name}</p>)}
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Serviço ({company.serviceFee}%)</span><span className="tabular-nums">{brl(fee)}</span></div>
                      <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="tabular-nums">{brl(total)}</span></div>
                    </div>
                    <div className="grid gap-2">
                      <Button asChild variant="outline" className="h-11"><Link to="/pdv">Lançar pedido no PDV</Link></Button>
                      {sel.status === "OCUPADA" && <Button variant="outline" className="h-11" onClick={() => requestClose(sel.id)}>Pedir conta</Button>}
                      <Button className="h-11" onClick={() => {
                        if (cash.status !== "OPEN") return toast.error("Abra o caixa antes de receber.");
                        if (total === 0) { releaseTable(sel.id); toast.success("Mesa liberada."); return setSelId(null); }
                        setPaying(true);
                      }}>Fechar conta</Button>
                    </div>
                    <div className="flex gap-2">
                      <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" aria-label="Mesa de destino">
                        <option value="">Transferir para…</option>
                        {tables.filter((t) => t.status === "LIVRE").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <Button variant="outline" disabled={!target} onClick={() => { transferTable(sel.id, target); setSelId(target); setTarget(""); toast.success("Mesa transferida."); }}>Transferir</Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        total={total}
        onConfirm={(p) => {
          if (!sel) return;
          const list = tabOrders(sel);
          list.forEach((o, idx) => {
            const share = orderTotal(o) * (1 + company.serviceFee / 100);
            payOrder(o.id, [{ ...p, amount: share, received: idx === 0 ? p.received : undefined, change: idx === 0 ? p.change : undefined }]);
          });
          releaseTable(sel.id);
          toast.success(`Conta fechada: ${brl(total)}`);
          setPaying(false);
          setSelId(null);
        }}
      />
    </div>
  );
}
