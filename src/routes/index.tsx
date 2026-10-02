import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChefHat,
  CircleCheck,
  DollarSign,
  Plus,
  Receipt,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { Indicador } from "@/components/shared/indicador";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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
import { formatarNumeroQuantidade, UNIDADE_LABEL } from "@/services/estoque";

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

const hoje = () => {
  const texto = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Dashboard() {
  const resumo = useResumoDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={hoje()}
        actions={
          <Button asChild>
            <Link to="/pedidos">
              <Plus className="size-4" aria-hidden="true" /> Novo pedido
            </Link>
          </Button>
        }
      />

      {resumo.isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-busy="true">
          <span className="sr-only">Carregando resumo do dia…</span>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-24" />
              <Skeleton className="mt-1.5 h-3 w-16" />
            </div>
          ))}
        </div>
      ) : resumo.isError ? (
        <ErrorState
          description="Não foi possível carregar o resumo do dia."
          onRetry={() => void resumo.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <Indicador
            rotulo="Vendas hoje"
            valor={brl(resumo.data.faturamento)}
            dica={plural(resumo.data.pedidos, "pedido", "pedidos")}
            icone={DollarSign}
            tom="primario"
          />
          <Indicador
            rotulo="Ticket médio"
            valor={brl(resumo.data.ticketMedio)}
            dica="por pedido"
            icone={Receipt}
          />
          <Indicador
            rotulo="Na cozinha"
            valor={resumo.data.naFila + resumo.data.emPreparo + resumo.data.prontos}
            dica={
              resumo.data.prontos > 0
                ? `${plural(resumo.data.prontos, "pronto", "prontos")} p/ entregar`
                : resumo.data.naFila > 0
                  ? `${plural(resumo.data.naFila, "novo", "novos")} na fila`
                  : `${resumo.data.emPreparo} em preparo`
            }
            icone={ChefHat}
            tom={resumo.data.prontos > 0 ? "atencao" : "neutro"}
          />
          <Indicador
            rotulo="Mesas ocupadas"
            valor={`${resumo.data.mesasOcupadas}/${resumo.data.mesasTotal}`}
            dica={plural(
              Math.max(resumo.data.mesasTotal - resumo.data.mesasOcupadas, 0),
              "livre",
              "livres",
            )}
            icone={UtensilsCrossed}
          />
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <PedidosDeHoje />
        <div className="space-y-4">
          <CaixaAtual />
          <EstoqueBaixo />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

function Bloco({
  titulo,
  extra,
  className,
  children,
}: {
  titulo: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className={cn("rounded-xl border border-border bg-card shadow-xs", className)}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

const ERRO_NO_BLOCO = "border-0 bg-transparent px-4 py-6 shadow-none";

function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">{children}</p>;
}

function LinhasCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <ul className="divide-y divide-border border-t border-border" aria-busy="true">
      {Array.from({ length: linhas }, (_, n) => (
        <li key={n} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}

function PedidosDeHoje() {
  const pedidos = usePedidosDeHoje();

  return (
    <Bloco
      titulo="Pedidos de hoje"
      className="xl:col-span-2"
      extra={
        pedidos.data && pedidos.data.length > 0 ? (
          <span className="text-xs font-medium text-muted-foreground">
            {plural(pedidos.data.length, "pedido", "pedidos")}
          </span>
        ) : null
      }
    >
      {pedidos.isPending ? (
        <LinhasCarregando />
      ) : pedidos.isError ? (
        <ErrorState
          className={ERRO_NO_BLOCO}
          description="Não foi possível carregar os pedidos."
          onRetry={() => void pedidos.refetch()}
        />
      ) : pedidos.data.length === 0 ? (
        <Vazio>Nenhum pedido lançado hoje.</Vazio>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {pedidos.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground tabular-nums">#{p.numero}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.origem === "MESA" ? "Mesa" : "Balcão"} · {time(p.criadoEm)}
                </p>
              </div>
              <StatusBadge tone={STATUS_PEDIDO[p.statusOperacional].tone} className="shrink-0">
                {STATUS_PEDIDO[p.statusOperacional].label}
              </StatusBadge>
              <span className="w-20 shrink-0 text-right font-semibold tabular-nums sm:w-24">
                {brl(p.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
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
    <Bloco
      titulo="Caixa"
      extra={
        sessao.data ? (
          <StatusBadge tone="primary">Aberto</StatusBadge>
        ) : sessao.isSuccess ? (
          <StatusBadge tone="neutral">Fechado</StatusBadge>
        ) : null
      }
    >
      <div className="px-4 pb-4 sm:px-5">
        {sessao.isPending ? (
          <div aria-busy="true">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-8 w-36" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ) : sessao.isError ? (
          <ErrorState
            className="border-0 bg-transparent px-0 py-4 shadow-none"
            description="Não foi possível carregar o caixa."
            onRetry={() => void sessao.refetch()}
          />
        ) : !sessao.data ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Abra o caixa para receber pagamentos.</p>
            <Button asChild>
              <Link to="/caixa">
                <Wallet className="size-4" aria-hidden="true" /> Abrir caixa
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground">Dinheiro na gaveta</p>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {brl(sessao.data.dinheiroEsperado)}
            </p>
            <p className="text-xs text-muted-foreground">
              Caixa {sessao.data.numero} · aberto às {time(sessao.data.abertaEm)}
            </p>
            <ul className="mt-4 space-y-2.5">
              {porMetodo.map(([metodo, valor]) => (
                <li key={metodo} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{METODO_LABEL[metodo]}</span>
                    <span className="font-semibold tabular-nums">{brl(valor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${(Math.max(valor, 0) / maior) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link to="/caixa">Ir para o caixa</Link>
            </Button>
          </>
        )}
      </div>
    </Bloco>
  );
}

function EstoqueBaixo() {
  const { papel } = useEmpresaAtual();
  const alertas = useEstoqueEmAlerta();
  // Nota: controla apenas a interface; a rota e a RLS decidem o acesso ao estoque.
  const podeVerEstoque = podeVerModulo(papel, "estoque");

  return (
    <Bloco
      titulo="Estoque baixo"
      extra={
        podeVerEstoque && (
          <Button asChild variant="link" size="sm" className="h-8 px-0">
            <Link to="/estoque">Ver estoque</Link>
          </Button>
        )
      }
    >
      {alertas.isPending ? (
        <LinhasCarregando linhas={3} />
      ) : alertas.isError ? (
        <ErrorState
          className={ERRO_NO_BLOCO}
          description="Não foi possível carregar o estoque."
          onRetry={() => void alertas.refetch()}
        />
      ) : alertas.data.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-5 text-sm text-muted-foreground sm:px-5">
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
          Nenhum item abaixo do mínimo.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {alertas.data.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{i.nome}</p>
                <p className="text-xs whitespace-nowrap tabular-nums">
                  <span
                    className={cn(
                      "font-bold",
                      i.status === "SEM_ESTOQUE" ? "text-destructive" : "text-warning-foreground",
                    )}
                  >
                    {formatarNumeroQuantidade(i.quantidade)}
                  </span>{" "}
                  <span className="text-muted-foreground">{UNIDADE_LABEL[i.unidade]}</span>
                </p>
              </div>
              <StatusBadge tone={STATUS_ESTOQUE[i.status].tone} className="shrink-0">
                {STATUS_ESTOQUE[i.status].label}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}
