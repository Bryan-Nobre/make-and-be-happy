import { createFileRoute } from "@tanstack/react-router";
import { Ban, DollarSign, Receipt, ShoppingBag } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import type { PaymentMethod } from "@/data/types";
import { brl } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/labels";
import { orderTotal, useArvon } from "@/store/arvon";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ARVON FOOD" },
      { name: "description", content: "Vendas, produtos mais vendidos e formas de pagamento." },
      { property: "og:title", content: "Relatórios — ARVON FOOD" },
      { property: "og:description", content: "Vendas, produtos mais vendidos e formas de pagamento." },
    ],
  }),
  component: () => (
    <AppLayout module="relatorios">
      <Relatorios />
    </AppLayout>
  ),
});

function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-2"><span className="truncate">{label}</span><span className="tabular-nums">{text}</span></div>
      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div>
    </li>
  );
}

function Relatorios() {
  const { orders, categories, products } = useArvon();
  const done = orders.filter((o) => o.status === "COMPLETED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const revenue = done.reduce((s, o) => s + orderTotal(o), 0);

  const byProduct = new Map<string, { qty: number; value: number }>();
  const byCat = new Map<string, number>();
  const byPay: Record<PaymentMethod, number> = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0 };
  done.forEach((o) => {
    o.items.forEach((i) => {
      const v = i.quantity * (i.unitPrice + i.addons.reduce((a, b) => a + b.price, 0));
      const cur = byProduct.get(i.name) ?? { qty: 0, value: 0 };
      byProduct.set(i.name, { qty: cur.qty + i.quantity, value: cur.value + v });
      const cat = categories.find((c) => c.id === products.find((p) => p.id === i.productId)?.categoryId)?.name ?? "Outros";
      byCat.set(cat, (byCat.get(cat) ?? 0) + v);
    });
    o.payments.forEach((p) => (byPay[p.method] += p.amount));
  });
  const top = [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxPay = Math.max(0, ...Object.values(byPay));

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Desempenho de vendas do período atual." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={brl(revenue)} icon={DollarSign} />
        <KpiCard label="Pedidos finalizados" value={String(done.length)} icon={ShoppingBag} />
        <KpiCard label="Ticket médio" value={brl(done.length ? revenue / done.length : 0)} icon={Receipt} />
        <KpiCard label="Cancelamentos" value={String(cancelled.length)} icon={Ban} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Mais vendidos</h2>
          <ul className="mt-3 space-y-3">{top.map(([n, d]) => <Bar key={n} label={n} value={d.qty} max={top[0]?.[1].qty ?? 0} text={`${d.qty} un · ${brl(d.value)}`} />)}</ul>
          {top.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Sem vendas finalizadas.</p>}
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Por categoria</h2>
          <ul className="mt-3 space-y-3">{cats.map(([n, v]) => <Bar key={n} label={n} value={v} max={cats[0]?.[1] ?? 0} text={brl(v)} />)}</ul>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Por pagamento</h2>
          <ul className="mt-3 space-y-3">{(Object.keys(byPay) as PaymentMethod[]).map((m) => <Bar key={m} label={PAYMENT_LABEL[m]} value={byPay[m]} max={maxPay} text={brl(byPay[m])} />)}</ul>
        </section>
      </div>
      {cancelled.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Cancelamentos</h2>
          <ul className="mt-2 divide-y text-sm">{cancelled.map((o) => <li key={o.id} className="flex justify-between py-2"><span>#{o.number} · {o.cancelReason ?? "Sem motivo"}</span><span className="tabular-nums">{brl(orderTotal(o))}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
