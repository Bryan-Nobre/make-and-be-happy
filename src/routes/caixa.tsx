import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CashMovementType, PaymentMethod } from "@/data/types";
import { brl, dateTime, time } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/labels";
import { expectedCash, salesByMethod, useArvon } from "@/store/arvon";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — ARVON FOOD" },
      { name: "description", content: "Abertura, sangria, suprimento e fechamento de caixa." },
      { property: "og:title", content: "Caixa — ARVON FOOD" },
      { property: "og:description", content: "Abertura, sangria, suprimento e fechamento de caixa." },
    ],
  }),
  component: () => (
    <AppLayout module="caixa">
      <Caixa />
    </AppLayout>
  ),
});

const MV_LABEL: Record<CashMovementType, string> = {
  OPENING: "Abertura", SALE: "Venda", WITHDRAWAL: "Sangria", SUPPLY: "Suprimento", ADJUSTMENT: "Ajuste", REFUND: "Estorno",
};

function Caixa() {
  const { cash, cashHistory, currentUser, openCash, addCashMovement, closeCash } = useArvon();
  const [amount, setAmount] = useState<number | "">("");
  const [mv, setMv] = useState<null | "WITHDRAWAL" | "SUPPLY">(null);
  const [mvAmount, setMvAmount] = useState<number | "">("");
  const [mvDesc, setMvDesc] = useState("");
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState<number | "">("");
  const [reason, setReason] = useState("");

  if (cash.status === "CLOSED") {
    return (
      <div className="space-y-6">
        <PageHeader title="Caixa" description="O caixa está fechado." />
        <div className="max-w-md space-y-3 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Abrir caixa</h2>
          <Label htmlFor="op">Fundo de troco</Label>
          <MoneyInput id="op" value={amount} onChange={setAmount} />
          <Button className="h-11 w-full" onClick={() => { openCash(currentUser.name, Number(amount || 0)); toast.success("Caixa aberto."); setAmount(""); }}>Abrir caixa</Button>
        </div>
        <History list={cashHistory} />
      </div>
    );
  }

  const expected = expectedCash(cash);
  const by = salesByMethod(cash);
  const totalSales = Object.values(by).reduce((a, b) => a + b, 0);
  const diff = Number(counted || 0) - expected;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caixa"
        description={`Aberto por ${cash.responsible} em ${dateTime(cash.openedAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setMv("SUPPLY")}>Suprimento</Button>
            <Button variant="outline" onClick={() => setMv("WITHDRAWAL")}>Sangria</Button>
            <Button variant="destructive" onClick={() => setClosing(true)}>Fechar caixa</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Fundo inicial" value={brl(cash.openingAmount)} icon={Wallet} />
        <KpiCard label="Vendas" value={brl(totalSales)} />
        <KpiCard label="Dinheiro esperado" value={brl(expected)} icon={Banknote} />
        <KpiCard label="Movimentos" value={String(cash.movements.length)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Por forma de pagamento</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(Object.keys(by) as PaymentMethod[]).map((m) => (
              <li key={m} className="flex justify-between"><span>{PAYMENT_LABEL[m]}</span><span className="tabular-nums">{brl(by[m])}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h2 className="font-semibold">Movimentações</h2>
          <ul className="mt-3 divide-y text-sm">
            {[...cash.movements].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-12 text-muted-foreground tabular-nums">{time(m.at)}</span>
                <span className="w-24 font-medium">{MV_LABEL[m.type]}</span>
                <span className="flex-1 text-muted-foreground">{m.description}{m.method && ` · ${PAYMENT_LABEL[m.method]}`}</span>
                <span className={`tabular-nums ${m.type === "WITHDRAWAL" || m.type === "REFUND" ? "text-destructive" : ""}`}>
                  {m.type === "WITHDRAWAL" || m.type === "REFUND" ? "−" : ""}{brl(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <History list={cashHistory} />

      <Dialog open={!!mv} onOpenChange={(o) => !o && setMv(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mv === "SUPPLY" ? "Suprimento" : "Sangria"}</DialogTitle></DialogHeader>
          <Label htmlFor="mva">Valor</Label>
          <MoneyInput id="mva" value={mvAmount} onChange={setMvAmount} autoFocus />
          <Label htmlFor="mvd">Motivo</Label>
          <Input id="mvd" value={mvDesc} onChange={(e) => setMvDesc(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => {
              const v = Number(mvAmount || 0);
              if (v <= 0 || !mvDesc.trim()) return toast.error("Informe valor e motivo.");
              if (mv === "WITHDRAWAL" && v > expected) return toast.error("Sangria maior que o dinheiro em caixa.");
              addCashMovement(mv!, v, mvDesc);
              toast.success("Movimentação registrada.");
              setMv(null); setMvAmount(""); setMvDesc("");
            }}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar caixa</DialogTitle></DialogHeader>
          <p className="text-sm">Dinheiro esperado: <strong>{brl(expected)}</strong></p>
          <Label htmlFor="cnt">Valor contado</Label>
          <MoneyInput id="cnt" value={counted} onChange={setCounted} autoFocus />
          {counted !== "" && (
            <p className={`text-sm font-medium ${diff === 0 ? "text-success" : "text-destructive"}`}>
              Diferença: {brl(diff)}
            </p>
          )}
          {counted !== "" && diff !== 0 && (
            <>
              <Label htmlFor="rsn">Justificativa</Label>
              <Input id="rsn" value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => {
              if (counted === "") return toast.error("Informe o valor contado.");
              if (diff !== 0 && !reason.trim()) return toast.error("Justifique a diferença.");
              closeCash(Number(counted), reason || undefined);
              toast.success("Caixa fechado.");
              setClosing(false); setCounted(""); setReason("");
            }}>Confirmar fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function History({ list }: { list: ReturnType<typeof useArvon>["cashHistory"] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Fechamentos anteriores</h2>
      {list.length === 0 ? (
        <div className="mt-3"><EmptyState icon={Wallet} title="Sem histórico" description="Os fechamentos desta sessão aparecerão aqui." /></div>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{c.responsible} · {c.closedAt && dateTime(c.closedAt)}</span>
              <span className="tabular-nums">Contado {brl(c.countedAmount ?? 0)} · Dif. {brl(c.difference ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
