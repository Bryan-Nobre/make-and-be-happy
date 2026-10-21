import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Clock,
  Info,
  List,
  Lock,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ControlesPagina } from "@/components/shared/controles-pagina";
import { DialogoMotivo } from "@/components/shared/dialogo-motivo";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { DialogoPagamento } from "@/components/shared/payment-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useCaixaMutations,
  useFechamentos,
  useMovimentacoes,
  usePagamentos,
  usePedidosAReceber,
  usePendenciasCaixa,
  useRealtimeCaixa,
  useSessaoAberta,
} from "@/hooks/use-caixa";
import { usePaginaLista } from "@/hooks/use-pagina-lista";
import { brl, dateTime, time } from "@/lib/format";
import { TIPO_MOVIMENTACAO } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import { useEmpresaAtual } from "@/providers/empresa";
import type {
  MovimentacaoCaixa,
  PagamentoCaixa,
  PedidoAReceber,
  SessaoCaixa,
} from "@/services/caixa";
import { METODO_LABEL } from "@/services/configuracoes";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Arvon Food" },
      { name: "description", content: "Abertura, sangria, suprimento e fechamento de caixa." },
      { property: "og:title", content: "Caixa — Arvon Food" },
      {
        property: "og:description",
        content: "Abertura, sangria, suprimento e fechamento de caixa.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="caixa">
      <Caixa />
    </AppLayout>
  ),
});

type TipoManual = "SANGRIA" | "SUPRIMENTO";

const CAMPO_VALOR = "h-12 text-lg font-semibold tabular-nums";
/** Listas do caixa: sempre 6 por página. */
const POR_PAGINA_CAIXA = 6;

function Secao({
  id,
  titulo,
  icone,
  extra,
  className,
  children,
}: {
  id?: string;
  titulo: string;
  icone?: ReactNode;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className={cn(
        "scroll-mt-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          {icone}
          {titulo}
        </h2>
        {extra}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dica({ texto }: { texto: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={texto}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{texto}</TooltipContent>
    </Tooltip>
  );
}

function Caixa() {
  useRealtimeCaixa();
  const sessao = useSessaoAberta();

  if (sessao.isPending) {
    return (
      <div className="space-y-6">
        <PageHeader title="Caixa" description="Controle financeiro da operação." />
        <LoadingState label="Carregando caixa…" />
      </div>
    );
  }
  if (sessao.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Caixa" description="Controle financeiro da operação." />
        <ErrorState
          description="Não foi possível carregar o caixa."
          onRetry={() => void sessao.refetch()}
        />
      </div>
    );
  }

  if (!sessao.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Caixa"
          description="Abra o caixa para receber pagamentos."
          actions={
            <StatusBadge tone="neutral" className="h-7 px-3 text-sm">
              Fechado
            </StatusBadge>
          }
        />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AbrirCaixa />
          <UltimoFechamento />
        </div>
        <Fechamentos />
      </div>
    );
  }

  return <CaixaAberto sessao={sessao.data} />;
}

function AbrirCaixa() {
  const { abrir } = useCaixaMutations();
  const [valor, setValor] = useState<number | "">("");
  const [observacao, setObservacao] = useState("");
  const [requisicaoId] = useState(() => novoUuid());
  const valido = valor !== "" && valor >= 0;

  return (
    <form
      aria-label="Abrir caixa"
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        abrir.mutate({ valorInicial: Number(valor), observacao, requisicaoId });
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">Abrir caixa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o fundo de troco que está na gaveta. Pode ser R$ 0,00.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fundo">Dinheiro inicial (fundo de troco)</Label>
        <MoneyInput
          id="fundo"
          value={valor}
          onChange={setValor}
          autoFocus
          className={CAMPO_VALOR}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="obs-abertura">Observação (opcional)</Label>
        <Input
          id="obs-abertura"
          value={observacao}
          maxLength={300}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="operational"
        className="w-full"
        disabled={!valido || abrir.isPending}
      >
        {abrir.isPending ? "Abrindo…" : "Abrir caixa"}
      </Button>
    </form>
  );
}

function UltimoFechamento() {
  const fechamentos = useFechamentos();
  const ultimo = fechamentos.data?.[0];
  if (!ultimo) return null;

  return (
    <section
      aria-label="Último fechamento"
      className="rounded-xl border border-border bg-card p-6 shadow-xs"
    >
      <h2 className="text-base font-semibold text-foreground">Último fechamento</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Caixa {ultimo.numero} · {ultimo.nomeFechamento ?? ultimo.nomeAbertura}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Aberto em</dt>
          <dd className="mt-0.5 font-medium text-foreground">{dateTime(ultimo.abertaEm)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fechado em</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {ultimo.fechadaEm ? dateTime(ultimo.fechadaEm) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dinheiro contado</dt>
          <dd className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {ultimo.dinheiroInformado !== null ? brl(ultimo.dinheiroInformado) : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function CaixaAberto({ sessao }: { sessao: SessaoCaixa }) {
  const [movimento, setMovimento] = useState<TipoManual | null>(null);
  const [fechando, setFechando] = useState(false);
  const [focoPendencias, setFocoPendencias] = useState(false);

  const vendas = sessao.totalDinheiro + sessao.totalPix + sessao.totalDebito + sessao.totalCredito;
  const porForma = [
    { rotulo: METODO_LABEL.DINHEIRO, valor: sessao.totalDinheiro },
    { rotulo: METODO_LABEL.PIX, valor: sessao.totalPix },
    { rotulo: METODO_LABEL.DEBITO, valor: sessao.totalDebito },
    { rotulo: METODO_LABEL.CREDITO, valor: sessao.totalCredito },
  ];

  const irParaPendencias = () => {
    setFocoPendencias(true);
    document
      .getElementById("caixa-a-receber")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <PageHeader
          title="Caixa"
          description={`Caixa ${sessao.numero} · Aberto às ${time(sessao.abertaEm)} · ${sessao.nomeAbertura}`}
          actions={
            <StatusBadge tone="primary" className="h-7 px-3 text-sm">
              Aberto
            </StatusBadge>
          }
        />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,32%)]">
          {/* Coluna principal (~70%) */}
          <div className="space-y-4">
            <section
              aria-label="Resumo financeiro"
              className="grid overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:grid-cols-2"
            >
              <div className="space-y-1 border-b border-border p-4 sm:border-r sm:border-b-0 sm:p-5">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Dinheiro esperado (gaveta)
                  <Dica texto="Fundo inicial + vendas em dinheiro + suprimentos − sangrias − trocos. É o valor físico esperado na gaveta." />
                </div>
                <p className="text-3xl font-bold tracking-tight text-primary tabular-nums">
                  {brl(sessao.dinheiroEsperado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fundo inicial: {brl(sessao.valorInicial)}
                </p>
              </div>
              <div className="space-y-1 p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Vendas recebidas
                  <Dica texto="Total recebido nesta sessão (Pix, dinheiro e cartões), já descontando estornos." />
                </div>
                <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {brl(vendas)}
                </p>
                <p className="text-xs text-muted-foreground">Pix, dinheiro e cartões</p>
              </div>
            </section>

            <div className="grid gap-2 sm:grid-cols-3">
              <BotaoAcao
                icone={<ArrowDownToLine className="size-4" aria-hidden="true" />}
                titulo="Suprimento"
                descricao="Adicionar dinheiro"
                onClick={() => setMovimento("SUPRIMENTO")}
              />
              <BotaoAcao
                icone={<ArrowUpFromLine className="size-4" aria-hidden="true" />}
                titulo="Sangria"
                descricao="Retirar dinheiro"
                onClick={() => setMovimento("SANGRIA")}
              />
              <BotaoAcao
                icone={<List className="size-4" aria-hidden="true" />}
                titulo="Movimentações"
                descricao="Ver histórico"
                onClick={() =>
                  document
                    .getElementById("caixa-movimentacoes")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
            </div>

            {/* Mobile: fechar e pendências logo após as ações */}
            <div className="space-y-3 lg:hidden">
              <CardFechamento onFechar={() => setFechando(true)} />
              <CardPendencias onVer={irParaPendencias} />
            </div>

            <Movimentacoes sessaoId={sessao.id} quantidade={sessao.movimentacoes} />
            <Pagamentos sessaoId={sessao.id} />
            <AReceber destacado={focoPendencias} />
            <Fechamentos />
          </div>

          {/* Coluna direita (~30%) — desktop */}
          <aside className="hidden space-y-4 lg:sticky lg:top-4 lg:block">
            <CardFechamento onFechar={() => setFechando(true)} />
            <CardPendencias onVer={irParaPendencias} />
            <Secao titulo="Vendas por forma de pagamento">
              <ul className="space-y-3.5">
                {porForma.map((f) => {
                  const parte =
                    vendas > 0 ? Math.max(0, Math.min(100, (f.valor / vendas) * 100)) : 0;
                  return (
                    <li key={f.rotulo} className="space-y-1.5 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-foreground">{f.rotulo}</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {brl(f.valor)}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {parte.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${parte}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Secao>
            <Secao titulo="Resumo da sessão">
              <dl className="space-y-2.5 text-sm">
                <LinhaResumo rotulo="Abertura" valor={dateTime(sessao.abertaEm)} />
                <LinhaResumo rotulo="Fundo de troco" valor={brl(sessao.valorInicial)} />
                <LinhaResumo rotulo="Suprimentos" valor={brl(sessao.suprimentos)} />
                <LinhaResumo rotulo="Sangrias" valor={brl(sessao.sangrias)} />
                <LinhaResumo rotulo="Vendas recebidas" valor={brl(vendas)} />
                {sessao.totalEstornos > 0 && (
                  <LinhaResumo rotulo="Estornos" valor={brl(sessao.totalEstornos)} />
                )}
                <div className="border-t border-border pt-2.5">
                  <LinhaResumo
                    rotulo="Saldo na gaveta"
                    valor={brl(sessao.dinheiroEsperado)}
                    destaque
                  />
                </div>
              </dl>
            </Secao>
          </aside>
        </div>

        {/* Mobile: resumo e formas no fim */}
        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          <Secao titulo="Vendas por forma de pagamento">
            <ul className="space-y-3 text-sm">
              {porForma.map((f) => (
                <li key={f.rotulo} className="flex items-center justify-between gap-2">
                  <span>{f.rotulo}</span>
                  <span className="font-semibold tabular-nums">{brl(f.valor)}</span>
                </li>
              ))}
            </ul>
          </Secao>
          <Secao titulo="Resumo da sessão">
            <dl className="space-y-2 text-sm">
              <LinhaResumo rotulo="Fundo de troco" valor={brl(sessao.valorInicial)} />
              <LinhaResumo rotulo="Vendas recebidas" valor={brl(vendas)} />
              <LinhaResumo rotulo="Saldo na gaveta" valor={brl(sessao.dinheiroEsperado)} destaque />
            </dl>
          </Secao>
        </div>
      </div>

      <DialogoMovimento
        tipo={movimento}
        dinheiroEsperado={sessao.dinheiroEsperado}
        aoFechar={() => setMovimento(null)}
      />
      <DialogoFechamento sessao={sessao} aberto={fechando} aoFechar={() => setFechando(false)} />
    </TooltipProvider>
  );
}

function BotaoAcao({
  icone,
  titulo,
  descricao,
  onClick,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left shadow-xs transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descricao}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function CardFechamento({ onFechar }: { onFechar: () => void }) {
  return (
    <section
      aria-label="Fechamento do caixa"
      className="rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Encerrar expediente</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Confirme o dinheiro, registre a diferença e finalize a sessão.
          </p>
        </div>
      </div>
      <Button type="button" size="operational" className="mt-3 w-full" onClick={onFechar}>
        Fechar caixa
      </Button>
    </section>
  );
}

function CardPendencias({ onVer }: { onVer: () => void }) {
  const pendencias = usePendenciasCaixa();
  const qtd = pendencias.data ? pendencias.data.pedidos + pendencias.data.comandas : 0;

  if (pendencias.isPending) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-xs">
        Verificando contas pendentes…
      </div>
    );
  }

  if (pendencias.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/20 bg-destructive-soft p-4 text-sm shadow-xs"
      >
        <p className="font-semibold text-destructive">Não foi possível verificar pendências.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => void pendencias.refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (qtd === 0) {
    return (
      <div className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success shadow-xs">
        Nenhuma conta pendente. Pode fechar o caixa.
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm shadow-xs"
    >
      <p className="font-semibold text-warning-foreground">Há contas pendentes</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        {pendencias.data.pedidos} pedido(s) de balcão e {pendencias.data.comandas} comanda(s) ·{" "}
        {brl(pendencias.data.valor)}. Receba tudo antes de fechar.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onVer}>
          Ver pendências
        </Button>
        {pendencias.data.comandas > 0 && (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link to="/mesas">Ir às mesas</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function LinhaResumo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-muted-foreground", destaque && "font-medium text-foreground")}>
        {rotulo}
      </dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          destaque ? "font-bold text-foreground" : "font-medium text-foreground",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

function AReceber({ destacado }: { destacado?: boolean }) {
  const pedidos = usePedidosAReceber();
  const [recebendo, setRecebendo] = useState<PedidoAReceber | null>(null);
  const pagina = usePaginaLista(pedidos.data ?? [], POR_PAGINA_CAIXA);

  return (
    <Secao
      id="caixa-a-receber"
      titulo="Balcão a receber"
      className={cn(destacado && "ring-2 ring-warning/40")}
    >
      {pedidos.isPending ? (
        <LoadingState label="Carregando pedidos…" />
      ) : pedidos.isError ? (
        <ErrorState
          description="Não foi possível carregar os pedidos a receber."
          onRetry={() => void pedidos.refetch()}
        />
      ) : pagina.totalItens === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhum pedido de balcão em aberto.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border text-sm">
            {pagina.fatia.map((p) => {
              const saldo = p.total - p.valorPago;
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      Pedido #{p.numero}
                      {p.identificacao && ` · ${p.identificacao}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {time(p.criadoEm)}
                      {p.valorPago > 0 && ` · pago ${brl(p.valorPago)} de ${brl(p.total)}`}
                    </p>
                  </div>
                  <span className="font-semibold text-foreground tabular-nums">{brl(saldo)}</span>
                  <Button size="sm" onClick={() => setRecebendo(p)}>
                    Receber
                  </Button>
                </li>
              );
            })}
          </ul>
          <ControlesPagina
            pagina={pagina.pagina}
            totalPaginas={pagina.totalPaginas}
            totalItens={pagina.totalItens}
            tamanho={pagina.tamanho}
            onMudar={pagina.setPagina}
            sempreVisivel
          />
        </div>
      )}

      <DialogoPagamento
        aberto={!!recebendo}
        aoMudarAberto={(aberto) => !aberto && setRecebendo(null)}
        titulo={`Receber pedido #${recebendo?.numero ?? ""}${recebendo?.identificacao ? ` · ${recebendo.identificacao}` : ""}`}
        saldo={recebendo ? recebendo.total - recebendo.valorPago : 0}
        alvo={recebendo ? { pedidoId: recebendo.id } : null}
      />
    </Secao>
  );
}

function Pagamentos({ sessaoId }: { sessaoId: string }) {
  const { papel } = useEmpresaAtual();
  const pagamentos = usePagamentos(sessaoId);
  const { estornar } = useCaixaMutations();
  const [estornando, setEstornando] = useState<PagamentoCaixa | null>(null);
  const pagina = usePaginaLista(pagamentos.data ?? [], POR_PAGINA_CAIXA);

  // Nota: controla apenas a interface; `estornar_pagamento` valida o papel.
  const podeEstornar = papel === "owner" || papel === "admin";

  return (
    <Secao titulo="Pagamentos da sessão">
      {pagamentos.isPending ? (
        <LoadingState label="Carregando pagamentos…" />
      ) : pagamentos.isError ? (
        <ErrorState
          description="Não foi possível carregar os pagamentos."
          onRetry={() => void pagamentos.refetch()}
        />
      ) : pagina.totalItens === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhum pagamento nesta sessão.</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Data/Hora</th>
                  <th className="pb-2 font-medium">Origem</th>
                  <th className="pb-2 font-medium">Forma</th>
                  <th className="pb-2 text-right font-medium">Valor</th>
                  <th className="pb-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagina.fatia.map((p) => (
                  <tr key={p.id} className={cn(p.status === "ESTORNADO" && "opacity-70")}>
                    <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                      {time(p.criadoEm)}
                    </td>
                    <td className="py-2.5 font-medium text-foreground">
                      {p.pedidoNumero !== null
                        ? `Pedido #${p.pedidoNumero}`
                        : `Comanda #${p.comandaNumero ?? ""}`}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{METODO_LABEL[p.metodo]}</td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-semibold tabular-nums",
                        p.status === "ESTORNADO" && "line-through",
                      )}
                    >
                      {brl(p.valor)}
                    </td>
                    <td className="py-2.5 text-right">
                      {p.status === "ESTORNADO" ? (
                        <StatusBadge tone="danger" className="w-fit">
                          Estornado
                        </StatusBadge>
                      ) : (
                        podeEstornar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive hover:bg-destructive-soft hover:text-destructive"
                            onClick={() => setEstornando(p)}
                          >
                            Estornar
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ControlesPagina
            pagina={pagina.pagina}
            totalPaginas={pagina.totalPaginas}
            totalItens={pagina.totalItens}
            tamanho={pagina.tamanho}
            onMudar={pagina.setPagina}
            sempreVisivel
          />
        </div>
      )}

      <DialogoMotivo
        aberto={!!estornando}
        titulo="Estornar pagamento"
        descricao={`Valor: ${estornando ? brl(estornando.valor) : ""}. O valor sai do caixa e volta a ficar em aberto na conta. Essa operação ficará registrada no caixa e o motivo, na auditoria.`}
        confirmando={estornar.isPending}
        rotuloConfirmar="Confirmar estorno"
        rotuloConfirmando="Estornando…"
        exemplo="Ex.: cobrança em duplicidade"
        aoFechar={() => setEstornando(null)}
        aoConfirmar={(motivo) => {
          if (!estornando) return;
          estornar.mutate(
            { pagamentoId: estornando.id, motivo },
            { onSuccess: () => setEstornando(null) },
          );
        }}
      />
    </Secao>
  );
}

function Movimentacoes({ sessaoId, quantidade }: { sessaoId: string; quantidade: number }) {
  const movimentacoes = useMovimentacoes(sessaoId);
  const pagina = usePaginaLista(movimentacoes.data ?? [], POR_PAGINA_CAIXA);

  return (
    <Secao
      id="caixa-movimentacoes"
      titulo="Últimas movimentações"
      icone={<Clock className="size-4 text-muted-foreground" aria-hidden="true" />}
      extra={<span className="text-xs text-muted-foreground tabular-nums">{quantidade}</span>}
    >
      {movimentacoes.isPending ? (
        <LoadingState label="Carregando movimentações…" />
      ) : movimentacoes.isError ? (
        <ErrorState
          description="Não foi possível carregar as movimentações."
          onRetry={() => void movimentacoes.refetch()}
        />
      ) : pagina.totalItens === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhuma movimentação nesta sessão.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border text-sm">
            {pagina.fatia.map((m) => (
              <LinhaMovimentacao key={m.id} m={m} />
            ))}
          </ul>
          <ControlesPagina
            pagina={pagina.pagina}
            totalPaginas={pagina.totalPaginas}
            totalItens={pagina.totalItens}
            tamanho={pagina.tamanho}
            onMudar={pagina.setPagina}
            sempreVisivel
          />
        </div>
      )}
    </Secao>
  );
}

function LinhaMovimentacao({ m }: { m: MovimentacaoCaixa }) {
  const { label, saida } = TIPO_MOVIMENTACAO[m.tipo];
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          saida ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success",
        )}
        aria-hidden="true"
      >
        {saida ? (
          <ArrowUpFromLine className="size-3.5" />
        ) : (
          <ArrowDownToLine className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {time(m.criadoEm)}
          {m.descricao && ` · ${m.descricao}`}
          {m.tipo !== "ABERTURA" && ` · ${METODO_LABEL[m.metodo]}`}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          saida ? "text-destructive" : "text-success",
        )}
      >
        {saida ? "−" : "+"} {brl(m.valor)}
      </span>
    </li>
  );
}

function Fechamentos() {
  const fechamentos = useFechamentos();
  const pagina = usePaginaLista(fechamentos.data ?? [], POR_PAGINA_CAIXA);

  return (
    <Secao titulo="Fechamentos anteriores">
      {fechamentos.isPending ? (
        <LoadingState label="Carregando histórico…" />
      ) : fechamentos.isError ? (
        <ErrorState
          description="Não foi possível carregar o histórico."
          onRetry={() => void fechamentos.refetch()}
        />
      ) : pagina.totalItens === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sem histórico"
          description="Os caixas fechados aparecerão aqui."
        />
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border text-sm">
            {pagina.fatia.map((c) => {
              const dif = c.diferenca ?? 0;
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      Caixa {c.numero} · {c.nomeFechamento ?? c.nomeAbertura}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Aberto {dateTime(c.abertaEm)}
                      {" · "}
                      Fechado {c.fechadaEm ? dateTime(c.fechadaEm) : "—"}
                    </p>
                  </div>
                  <dl className="flex gap-5 text-right tabular-nums">
                    <div>
                      <dt className="text-xs text-muted-foreground">Esperado</dt>
                      <dd className="font-medium text-foreground">{brl(c.dinheiroEsperado)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Contado</dt>
                      <dd className="font-medium text-foreground">{brl(c.dinheiroInformado ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Diferença</dt>
                      <dd
                        className={cn(
                          "font-semibold",
                          dif < 0
                            ? "text-destructive"
                            : dif > 0
                              ? "text-warning-foreground"
                              : "text-foreground",
                        )}
                      >
                        {brl(dif)}
                      </dd>
                    </div>
                  </dl>
                  {c.justificativa && (
                    <span className="basis-full text-xs text-muted-foreground">
                      Justificativa: {c.justificativa}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <ControlesPagina
            pagina={pagina.pagina}
            totalPaginas={pagina.totalPaginas}
            totalItens={pagina.totalItens}
            tamanho={pagina.tamanho}
            onMudar={pagina.setPagina}
            sempreVisivel
          />
        </div>
      )}
    </Secao>
  );
}

function DialogoMovimento({
  tipo,
  dinheiroEsperado,
  aoFechar,
}: {
  tipo: TipoManual | null;
  dinheiroEsperado: number;
  aoFechar: () => void;
}) {
  const titulo = tipo === "SANGRIA" ? "Retirar dinheiro" : "Adicionar dinheiro";
  const subtitulo = tipo === "SANGRIA" ? "Sangria" : "Suprimento";

  return (
    <Dialog open={!!tipo} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {tipo === "SANGRIA"
              ? `${subtitulo}. Retirada da gaveta. Disponível: ${brl(dinheiroEsperado)}.`
              : `${subtitulo}. Entrada na gaveta, por exemplo para reforçar o troco.`}
          </DialogDescription>
        </DialogHeader>
        {tipo && (
          <FormularioMovimento
            tipo={tipo}
            dinheiroEsperado={dinheiroEsperado}
            aoFechar={aoFechar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormularioMovimento({
  tipo,
  dinheiroEsperado,
  aoFechar,
}: {
  tipo: TipoManual;
  dinheiroEsperado: number;
  aoFechar: () => void;
}) {
  const { movimentar } = useCaixaMutations();
  const [valor, setValor] = useState<number | "">("");
  const [descricao, setDescricao] = useState("");
  const [requisicaoId] = useState(() => novoUuid());

  const numero = Number(valor || 0);
  const excede = tipo === "SANGRIA" && numero > dinheiroEsperado;
  const valido = numero > 0 && descricao.trim().length >= 3 && !excede;

  return (
    <>
      <form
        id="form-movimento"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          movimentar.mutate(
            { tipo, valor: numero, descricao, requisicaoId },
            { onSuccess: aoFechar },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="mov-valor">Valor</Label>
          <MoneyInput
            id="mov-valor"
            value={valor}
            onChange={setValor}
            autoFocus
            className={CAMPO_VALOR}
          />
          {excede && (
            <p className="text-sm text-destructive" role="alert">
              A sangria passa do dinheiro disponível no caixa.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mov-descricao">Motivo</Label>
          <Input
            id="mov-descricao"
            value={descricao}
            maxLength={300}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              tipo === "SANGRIA" ? "Ex.: troco / depósito no banco" : "Ex.: reforço de troco"
            }
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" form="form-movimento" disabled={!valido || movimentar.isPending}>
          {movimentar.isPending
            ? "Registrando…"
            : tipo === "SANGRIA"
              ? "Confirmar sangria"
              : "Confirmar suprimento"}
        </Button>
      </DialogFooter>
    </>
  );
}

function DialogoFechamento({
  sessao,
  aberto,
  aoFechar,
}: {
  sessao: SessaoCaixa;
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>
            Caixa {sessao.numero}. Conte o dinheiro da gaveta. Depois de fechado, a sessão não pode
            mais ser alterada.
          </DialogDescription>
        </DialogHeader>
        <FormularioFechamento sessao={sessao} aoFechar={aoFechar} />
      </DialogContent>
    </Dialog>
  );
}

function FormularioFechamento({ sessao, aoFechar }: { sessao: SessaoCaixa; aoFechar: () => void }) {
  const { fechar } = useCaixaMutations();
  const pendencias = usePendenciasCaixa();
  const [contado, setContado] = useState<number | "">("");
  const [justificativa, setJustificativa] = useState("");

  const qtdPendente = pendencias.data ? pendencias.data.pedidos + pendencias.data.comandas : 0;
  const bloqueado = pendencias.isPending || pendencias.isError || qtdPendente > 0;

  const diferenca =
    contado === ""
      ? 0
      : (Math.round(contado * 100) - Math.round(sessao.dinheiroEsperado * 100)) / 100;
  const precisaJustificar = contado !== "" && diferenca !== 0;
  const valido = contado !== "" && (!precisaJustificar || justificativa.trim().length >= 3);

  return (
    <>
      <form
        id="form-fechamento"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido || bloqueado) return;
          fechar.mutate(
            { sessaoId: sessao.id, dinheiroInformado: Number(contado), justificativa },
            { onSuccess: aoFechar },
          );
        }}
      >
        {pendencias.isPending ? (
          <p className="text-sm text-muted-foreground">Verificando contas pendentes…</p>
        ) : pendencias.isError ? (
          <ErrorState
            description="Não foi possível verificar as contas pendentes."
            onRetry={() => void pendencias.refetch()}
            className="py-6"
          />
        ) : (
          qtdPendente > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm"
            >
              <p className="font-semibold text-destructive">
                {qtdPendente} conta(s) pendente(s) somando {brl(pendencias.data.valor)}.
              </p>
              <p className="text-muted-foreground">
                {pendencias.data.pedidos} pedido(s) de balcão e {pendencias.data.comandas}{" "}
                comanda(s) com saldo. Receba antes de fechar o caixa.
              </p>
            </div>
          )
        )}

        <div className="rounded-lg bg-muted/60 p-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Dinheiro esperado na gaveta
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {brl(sessao.dinheiroEsperado)}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contado">Dinheiro contado</Label>
          <MoneyInput
            id="contado"
            value={contado}
            onChange={setContado}
            autoFocus
            className={CAMPO_VALOR}
          />
        </div>

        <div
          aria-live="polite"
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
            contado === "" && "border-border text-muted-foreground",
            contado !== "" && diferenca === 0 && "border-success/20 bg-success-soft text-success",
            diferenca > 0 && "border-warning/25 bg-warning-soft text-warning-foreground",
            diferenca < 0 && "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          <span className="font-medium">
            Diferença
            {diferenca > 0 && " (sobra)"}
            {diferenca < 0 && " (falta)"}
          </span>
          <span className="text-lg font-bold tabular-nums">
            {contado === ""
              ? "—"
              : `${diferenca > 0 ? "+" : diferenca < 0 ? "−" : ""}${brl(Math.abs(diferenca))}`}
          </span>
        </div>

        {precisaJustificar && (
          <div className="space-y-1.5">
            <Label htmlFor="justificativa">Justificativa da diferença</Label>
            <Input
              id="justificativa"
              value={justificativa}
              maxLength={300}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="form-fechamento"
          disabled={!valido || bloqueado || fechar.isPending}
        >
          {fechar.isPending ? "Fechando…" : "Fechar caixa"}
        </Button>
      </DialogFooter>
    </>
  );
}
