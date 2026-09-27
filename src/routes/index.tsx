import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChefHat, DollarSign, Receipt, UtensilsCrossed } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { brl, time } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/labels";
import { orderTotal, salesByMethod, stockStatus, useArvon } from "@/store/arvon";
import { PAYMENT_LABEL } from "@/lib/labels";
import type { PaymentMethod } from "@/data/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ARVON FOOD" },
      { name: "description", content: "Visão geral do dia: vendas, pedidos, mesas e alertas do restaurante." },
      { property: "og:title", content: "Dashboard — ARVON FOOD" },
      { property: "og:description", content: "Visão geral do dia: vendas, pedidos, mesas e alertas do restaurante." },
    ],
  }),
  component: () => (
    <AppLayout module="dashboard">
      <Dashboard />
    </AppLayout>
  ),
});

function Dashboard() {
  const { orders, tables, stock, cash } = useArvon();
  const done = orders.filter((o) => o.status === "COMPLETED");
  const revenue = done.reduce((s, o) => s + orderTotal(o), 0);
  const open = orders.filter((o) => ["CONFIRMED", "PREPARING", "READY", "DELIVERED"].includes(o.status));
  const busy = tables.filter((t) => t.status !== "LIVRE").length;
  const low = stock.filter((i) => stockStatus(i) !== "NORMAL");
  const byMethod = salesByMethod(cash);
  const maxM = Math.max(1, ...Object.values(byMethod));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumo da operação de hoje."
        actions={<Button asChild><Link to="/pdv">Novo pedido</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={brl(revenue)} hint={`${done.length} pedidos finalizados`} icon={DollarSign} />
        <KpiCard label="Ticket médio" value={brl(done.length ? revenue / done.length : 0)} icon={Receipt} />
        <KpiCard label="Pedidos em aberto" value={String(open.length)} icon={ChefHat} />
        <KpiCard label="Mesas ocupadas" value={`${busy}/${tables.length}`} icon={UtensilsCrossed} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h2 className="font-semibold">Pedidos recentes</h2>
          <ul className="mt-3 divide-y">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">#{o.number}</span>
                <span className="flex-1 text-muted-foreground">
                  {o.origin === "MESA" ? `Comanda ${o.tabNumber}` : "Balcão"} · {time(o.createdAt)}
                </span>
                <StatusBadge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusBadge>
                <span className="w-24 text-right tabular-nums">{brl(orderTotal(o))}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Vendas por pagamento</h2>
            <ul className="mt-3 space-y-3">
              {(Object.keys(byMethod) as PaymentMethod[]).map((m) => (
                <li key={m} className="text-sm">
                  <div className="flex justify-between"><span>{PAYMENT_LABEL[m]}</span><span className="tabular-nums">{brl(byMethod[m])}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(byMethod[m] / maxM) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Alertas de estoque
            </h2>
            {low.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum item abaixo do mínimo.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {low.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.name}</span>
                    <StatusBadge tone={stockStatus(i) === "BAIXO" ? "warning" : "danger"}>
                      {i.quantity} {i.unit}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
