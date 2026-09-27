import { createFileRoute } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { Order, OrderStatus } from "@/data/types";
import { minutesSince, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useArvon } from "@/store/arvon";

export const Route = createFileRoute("/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — ARVON FOOD" },
      { name: "description", content: "Painel de produção com pedidos por etapa de preparo." },
      { property: "og:title", content: "Cozinha — ARVON FOOD" },
      { property: "og:description", content: "Painel de produção com pedidos por etapa de preparo." },
    ],
  }),
  component: () => (
    <AppLayout module="cozinha">
      <Cozinha />
    </AppLayout>
  ),
});

const COLS: { status: OrderStatus; title: string; next?: OrderStatus; action?: string }[] = [
  { status: "CONFIRMED", title: "Novos", next: "PREPARING", action: "Iniciar preparo" },
  { status: "PREPARING", title: "Em preparo", next: "READY", action: "Marcar pronto" },
  { status: "READY", title: "Prontos", next: "DELIVERED", action: "Entregar" },
];

function Cozinha() {
  const { orders, tables, setOrderStatus } = useArvon();
  return (
    <div className="space-y-6">
      <PageHeader title="Cozinha" description="Acompanhe e avance os pedidos em produção." />
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="rounded-lg border bg-muted/40 p-3">
              <h2 className="mb-3 flex items-center justify-between font-semibold">
                {col.title}<span className="rounded-md bg-card px-2 text-sm tabular-nums">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.length === 0 && <EmptyState icon={ChefHat} title="Nada aqui" description="Nenhum pedido nesta etapa." />}
                {list.map((o) => (
                  <Ticket key={o.id} order={o} tableName={tables.find((t) => t.id === o.tableId)?.name} action={col.action} onNext={() => col.next && setOrderStatus(o.id, col.next)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ticket({ order, tableName, action, onNext }: { order: Order; tableName?: string; action?: string; onNext: () => void }) {
  const m = minutesSince(order.createdAt);
  return (
    <article className={cn("rounded-lg border bg-card p-3", m >= 20 && "border-destructive/50", m >= 10 && m < 20 && "border-warning/60")}>
      <header className="flex items-center justify-between">
        <span className="font-bold">#{order.number}</span>
        <span className={cn("text-xs tabular-nums", m >= 20 ? "font-semibold text-destructive" : "text-muted-foreground")}>{time(order.createdAt)} · {m} min</span>
      </header>
      <p className="text-xs text-muted-foreground">{tableName ?? "Balcão"}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {order.items.map((i) => (
          <li key={i.id}>
            <span className="font-semibold">{i.quantity}×</span> {i.name}
            {i.addons.length > 0 && <span className="block text-xs text-muted-foreground">+ {i.addons.map((a) => a.name).join(", ")}</span>}
            {i.note && <span className="block text-xs font-medium text-warning-foreground">⚠ {i.note}</span>}
          </li>
        ))}
      </ul>
      {action && <Button className="mt-3 h-11 w-full" onClick={onNext}>{action}</Button>}
    </article>
  );
}
