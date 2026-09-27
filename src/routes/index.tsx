import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChefHat, DollarSign, Receipt, UtensilsCrossed, Wallet } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useSessaoAberta } from "@/hooks/use-caixa";
import { useEstoqueEmAlerta, usePedidosDeHoje, useResumoDashboard } from "@/hooks/use-relatorios";
import { brl, time } from "@/lib/format";
import { STATUS_ESTOQUE, STATUS_PEDIDO } from "@/lib/labels";
import { podeVerModulo } from "@/lib/permissoes";
import { useEmpresaAtual } from "@/providers/empresa";
import type { MetodoPagamento } from "@/services/configuracoes";
import { METODO_LABEL } from "@/services/configuracoes";
import { formatarQuantidade } from "@/services/estoque";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ARVON FOOD" },
      {
        name: "description",
        content: "Visão geral do dia: vendas, pedidos, mesas e alertas do restaurante.",
      },
      { property: "og:title", content: "Dashboard — ARVON FOOD" },
      {
        property: "og:description",
        content: "Visão geral do dia: vendas, pedidos, mesas e alertas do restaurante.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="dashboard">
      <Dashboard />
    </AppLayout>
  ),
});

function Dashboard() {
  const resumo = useResumoDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumo da operação de hoje."
        actions={
          <Button asChild>
            <Link to="/pdv">Novo pedido</Link>
          </Button>
        }
      />

      {resumo.isPending ? (
        <LoadingState label="Carregando resumo do dia…" />
      ) : resumo.isError ? (
        <ErrorState
          description="Não foi possível carregar o resumo do dia."
          onRetry={() => void resumo.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Vendas do dia"
            value={brl(resumo.data.faturamento)}
            hint={`${resumo.data.pedidos} ${resumo.data.pedidos === 1 ? "pedido" : "pedidos"}`}
            icon={DollarSign}
          />
          <KpiCard label="Ticket médio" value={brl(resumo.data.ticketMedio)} icon={Receipt} />
          <KpiCard
            label="Em produção"
            value={String(resumo.data.naFila + resumo.data.emPreparo)}
            hint={`${resumo.data.naFila} na fila · ${resumo.data.emPreparo} em preparo · ${resumo.data.prontos} ${resumo.data.prontos === 1 ? "pronto" : "prontos"}`}
            icon={ChefHat}
          />
          <KpiCard
            label="Mesas ocupadas"
            value={`${resumo.data.mesasOcupadas}/${resumo.data.mesasTotal}`}
            icon={UtensilsCrossed}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <PedidosRecentes />
        <div className="space-y-4">
          <CaixaAtual />
          <AlertasEstoque />
        </div>
      </div>
    </div>
  );
}

function PedidosRecentes() {
  const pedidos = usePedidosDeHoje();

  return (
    <section className="rounded-lg border bg-card p-4 lg:col-span-2" aria-labelledby="recentes">
      <h2 id="recentes" className="font-semibold">
        Pedidos de hoje
      </h2>
      {pedidos.isPending ? (
        <LoadingState className="mt-3 border-0" />
      ) : pedidos.isError ? (
        <p className="mt-3 text-sm text-destructive">Não foi possível carregar os pedidos.</p>
      ) : pedidos.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido lançado hoje.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {pedidos.data.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="font-medium">#{p.numero}</span>
              <span className="flex-1 text-muted-foreground">
                {p.origem === "MESA" ? "Mesa" : "Balcão"} · {time(p.criadoEm)}
              </span>
              <StatusBadge tone={STATUS_PEDIDO[p.statusOperacional].tone}>
                {STATUS_PEDIDO[p.statusOperacional].label}
              </StatusBadge>
              <span className="w-24 text-right tabular-nums">{brl(p.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CaixaAtual() {
  const { papel } = useEmpresaAtual();
  // Nota: esta verificação controla apenas a interface; a RLS decide quem lê o caixa.
  const podeVerCaixa = podeVerModulo(papel, "caixa");
  const sessao = useSessaoAberta({ habilitado: podeVerCaixa });

  if (!podeVerCaixa) return null;

  const porMetodo: [MetodoPagamento, number][] = sessao.data
    ? [
        ["DINHEIRO", sessao.data.totalDinheiro],
        ["PIX", sessao.data.totalPix],
        ["DEBITO", sessao.data.totalDebito],
        ["CREDITO", sessao.data.totalCredito],
      ]
    : [];
  const maior = Math.max(1, ...porMetodo.map(([, v]) => v));

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="caixa-atual">
      <h2 id="caixa-atual" className="flex items-center gap-2 font-semibold">
        <Wallet className="size-4 text-muted-foreground" aria-hidden="true" /> Caixa atual
      </h2>
      {sessao.isPending ? (
        <LoadingState className="mt-3 border-0" />
      ) : sessao.isError ? (
        <p className="mt-2 text-sm text-destructive">Não foi possível carregar o caixa.</p>
      ) : !sessao.data ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Caixa fechado.{" "}
          <Link to="/caixa" className="font-medium text-primary underline">
            Abrir caixa
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Caixa {sessao.data.numero} · aberto às {time(sessao.data.abertaEm)} · dinheiro na gaveta{" "}
            {brl(sessao.data.dinheiroEsperado)}
          </p>
          <ul className="mt-3 space-y-3">
            {porMetodo.map(([metodo, valor]) => (
              <li key={metodo} className="text-sm">
                <div className="flex justify-between">
                  <span>{METODO_LABEL[metodo]}</span>
                  <span className="tabular-nums">{brl(valor)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(Math.max(valor, 0) / maior) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function AlertasEstoque() {
  const alertas = useEstoqueEmAlerta();

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="alertas-estoque">
      <h2 id="alertas-estoque" className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Alertas de estoque
      </h2>
      {alertas.isPending ? (
        <LoadingState className="mt-3 border-0" />
      ) : alertas.isError ? (
        <p className="mt-2 text-sm text-destructive">Não foi possível carregar o estoque.</p>
      ) : alertas.data.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum item abaixo do mínimo.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {alertas.data.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span>{i.nome}</span>
              <StatusBadge tone={STATUS_ESTOQUE[i.status].tone}>
                {formatarQuantidade(i.quantidade, i.unidade)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
