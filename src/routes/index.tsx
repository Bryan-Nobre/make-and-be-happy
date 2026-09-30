import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChefHat,
  DollarSign,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessaoAberta } from "@/hooks/use-caixa";
import { useEstoqueEmAlerta, usePedidosDeHoje, useResumoDashboard } from "@/hooks/use-relatorios";
import { brl, time } from "@/lib/format";
import { STATUS_ESTOQUE, STATUS_PEDIDO } from "@/lib/labels";
import { podeVerModulo } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
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
        <Carregando
          label="Carregando resumo do dia…"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((n) => (
            <Card key={n} className="p-5">
              <div className="flex min-h-10 items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
              <Skeleton className="mt-2 h-8 w-32" />
              <Skeleton className="mt-2 h-3 w-40 max-w-full" />
            </Card>
          ))}
        </Carregando>
      ) : resumo.isError ? (
        <ErrorState
          description="Não foi possível carregar o resumo do dia."
          onRetry={() => void resumo.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Vendas do dia"
            value={brl(resumo.data.faturamento)}
            hint={`${resumo.data.pedidos} ${resumo.data.pedidos === 1 ? "pedido" : "pedidos"}`}
            icon={DollarSign}
          />
          <KpiCard label="Ticket médio" value={brl(resumo.data.ticketMedio)} icon={Receipt} />
          <KpiCard
            label="Em produção agora"
            value={String(resumo.data.naFila + resumo.data.emPreparo + resumo.data.prontos)}
            hint={`${resumo.data.naFila} ${resumo.data.naFila === 1 ? "novo" : "novos"} · ${resumo.data.emPreparo} em preparo · ${resumo.data.prontos} ${resumo.data.prontos === 1 ? "pronto" : "prontos"} (qualquer data)`}
            icon={ChefHat}
          />
          <KpiCard
            label="Mesas ocupadas"
            value={`${resumo.data.mesasOcupadas}/${resumo.data.mesasTotal}`}
            hint="Inclui contas pagas até a mesa ser liberada"
            icon={UtensilsCrossed}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <PedidosRecentes />
        <div className="space-y-4">
          <CaixaAtual />
          <AlertasEstoque />
        </div>
      </div>
    </div>
  );
}

const ERRO_NO_BLOCO = "border-0 bg-transparent px-0 py-6";
const VAZIO_NO_BLOCO = "text-sm text-muted-foreground";

function Carregando({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function CabecalhoBloco({
  id,
  icon: Icon,
  iconClassName = "text-foreground",
  titulo,
  acao,
}: {
  id: string;
  icon: typeof Wallet;
  iconClassName?: string;
  titulo: string;
  acao?: ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-3 pb-4">
      <CardTitle>
        <h2 id={id} className="flex items-center gap-2">
          <Icon className={cn("size-4.5 shrink-0", iconClassName)} aria-hidden="true" />
          {titulo}
        </h2>
      </CardTitle>
      {acao}
    </CardHeader>
  );
}

function PedidosRecentes() {
  const pedidos = usePedidosDeHoje();

  return (
    <Card role="region" aria-labelledby="recentes" className="xl:col-span-2">
      <CabecalhoBloco id="recentes" icon={ShoppingBag} titulo="Pedidos de hoje" />
      <CardContent>
        {pedidos.isPending ? (
          <Carregando label="Carregando pedidos…">
            <ul className="divide-y">
              {[0, 1, 2, 3].map((n) => (
                <li key={n} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </li>
              ))}
            </ul>
          </Carregando>
        ) : pedidos.isError ? (
          <ErrorState
            className={ERRO_NO_BLOCO}
            description="Não foi possível carregar os pedidos."
            onRetry={() => void pedidos.refetch()}
          />
        ) : pedidos.data.length === 0 ? (
          <p className={VAZIO_NO_BLOCO}>Nenhum pedido lançado hoje.</p>
        ) : (
          <ul className="divide-y">
            {pedidos.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="font-semibold text-foreground">#{p.numero}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {p.origem === "MESA" ? "Mesa" : "Balcão"} · {time(p.criadoEm)}
                  </span>
                </div>
                <StatusBadge tone={STATUS_PEDIDO[p.statusOperacional].tone}>
                  {STATUS_PEDIDO[p.statusOperacional].label}
                </StatusBadge>
                <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                  {brl(p.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
    <Card role="region" aria-labelledby="caixa-atual">
      <CabecalhoBloco id="caixa-atual" icon={Wallet} titulo="Caixa atual" />
      <CardContent>
        {sessao.isPending ? (
          <Carregando label="Carregando caixa…">
            <Skeleton className="h-4 w-3/4" />
            <ul className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((n) => (
                <li key={n}>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="mt-1 h-2 w-full rounded-full" />
                </li>
              ))}
            </ul>
          </Carregando>
        ) : sessao.isError ? (
          <ErrorState
            className={ERRO_NO_BLOCO}
            description="Não foi possível carregar o caixa."
            onRetry={() => void sessao.refetch()}
          />
        ) : !sessao.data ? (
          <p className={VAZIO_NO_BLOCO}>
            Caixa fechado.{" "}
            <Button asChild variant="link" className="h-auto p-0 align-baseline">
              <Link to="/caixa">Abrir caixa</Link>
            </Button>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Caixa {sessao.data.numero} · aberto às {time(sessao.data.abertaEm)} · dinheiro na
              gaveta {brl(sessao.data.dinheiroEsperado)}
            </p>
            <ul className="mt-4 space-y-3">
              {porMetodo.map(([metodo, valor]) => (
                <li key={metodo} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{METODO_LABEL[metodo]}</span>
                    <span className="font-medium tabular-nums">{brl(valor)}</span>
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
      </CardContent>
    </Card>
  );
}

function AlertasEstoque() {
  const { papel } = useEmpresaAtual();
  const alertas = useEstoqueEmAlerta();
  // Nota: controla apenas a interface; a rota e a RLS decidem o acesso ao estoque.
  const podeVerEstoque = podeVerModulo(papel, "estoque");

  return (
    <Card role="region" aria-labelledby="alertas-estoque">
      <CabecalhoBloco
        id="alertas-estoque"
        icon={AlertTriangle}
        iconClassName="text-warning"
        titulo="Alertas de estoque"
        acao={
          podeVerEstoque && (
            <Button asChild variant="link" className="h-auto shrink-0 p-0">
              <Link to="/estoque">Ver estoque</Link>
            </Button>
          )
        }
      />
      <CardContent>
        {alertas.isPending ? (
          <Carregando label="Carregando estoque…">
            <ul className="space-y-2">
              {[0, 1, 2].map((n) => (
                <li key={n} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </li>
              ))}
            </ul>
          </Carregando>
        ) : alertas.isError ? (
          <ErrorState
            className={ERRO_NO_BLOCO}
            description="Não foi possível carregar o estoque."
            onRetry={() => void alertas.refetch()}
          />
        ) : alertas.data.length === 0 ? (
          <p className={VAZIO_NO_BLOCO}>Nenhum item abaixo do mínimo.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {alertas.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{i.nome}</span>
                <StatusBadge tone={STATUS_ESTOQUE[i.status].tone} className="shrink-0">
                  {formatarQuantidade(i.quantidade, i.unidade)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
