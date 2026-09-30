import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CreditCard, QrCode, Receipt, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { DialogoMotivo } from "@/components/shared/dialogo-motivo";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
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
import { brl, dateTime, time } from "@/lib/format";
import { TIPO_MOVIMENTACAO } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import { useEmpresaAtual } from "@/providers/empresa";
import type { PagamentoCaixa, PedidoAReceber, SessaoCaixa } from "@/services/caixa";
import { METODO_LABEL } from "@/services/configuracoes";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — ARVON FOOD" },
      { name: "description", content: "Abertura, sangria, suprimento e fechamento de caixa." },
      { property: "og:title", content: "Caixa — ARVON FOOD" },
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

function Secao({
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
      className={cn("rounded-xl border border-border bg-card p-5 shadow-xs", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {extra}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SeloEstado({ aberto }: { aberto: boolean }) {
  return (
    <StatusBadge tone={aberto ? "primary" : "neutral"} className="h-7 px-3 text-sm">
      {aberto ? "Caixa aberto" : "Caixa fechado"}
    </StatusBadge>
  );
}

function Caixa() {
  useRealtimeCaixa();
  const sessao = useSessaoAberta();

  const cabecalho = <PageHeader title="Caixa" description="Controle financeiro da operação." />;

  if (sessao.isPending) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <LoadingState label="Carregando caixa…" />
      </div>
    );
  }
  if (sessao.isError) {
    return (
      <div className="space-y-6">
        {cabecalho}
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
        {cabecalho}
        <SeloEstado aberto={false} />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AbrirCaixa />
          <UltimoFechamento />
        </div>
        <Fechamentos />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cabecalho}
      <CaixaAberto sessao={sessao.data} />
    </div>
  );
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
        <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Abrir caixa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o fundo de troco que está na gaveta.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fundo">Valor inicial</Label>
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
      <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Último fechamento
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">Data/hora</dt>
          <dd className="mt-0.5 text-base font-semibold text-foreground">
            {ultimo.fechadaEm ? dateTime(ultimo.fechadaEm) : "—"}
          </dd>
          <dd className="text-xs text-muted-foreground">
            Caixa {ultimo.numero} · {ultimo.nomeFechamento ?? ultimo.nomeAbertura}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Valor de fechamento</dt>
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

  const vendas = sessao.totalDinheiro + sessao.totalPix + sessao.totalDebito + sessao.totalCredito;
  const porForma = [
    { rotulo: METODO_LABEL.DINHEIRO, valor: sessao.totalDinheiro },
    { rotulo: METODO_LABEL.PIX, valor: sessao.totalPix },
    { rotulo: METODO_LABEL.DEBITO, valor: sessao.totalDebito },
    { rotulo: METODO_LABEL.CREDITO, valor: sessao.totalCredito },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SeloEstado aberto />
        <p className="text-sm text-muted-foreground">
          Caixa {sessao.numero} · aberto por {sessao.nomeAbertura} em {dateTime(sessao.abertaEm)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section
          aria-label="Dinheiro esperado"
          className="rounded-xl border border-border bg-card p-6 shadow-xs lg:col-span-2"
        >
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Dinheiro esperado
          </h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-foreground tabular-nums">
            {brl(sessao.dinheiroEsperado)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Valor esperado no caixa</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Fundo inicial</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {brl(sessao.valorInicial)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Suprimentos</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {brl(sessao.suprimentos)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sangrias</dt>
              <dd className="font-semibold text-foreground tabular-nums">{brl(sessao.sangrias)}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-label="Ações do caixa"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-xs"
        >
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Ações
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => setMovimento("SANGRIA")}>
              Sangria
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setMovimento("SUPRIMENTO")}>
              Suprimento
            </Button>
          </div>
          <Button size="operational" className="mt-auto w-full" onClick={() => setFechando(true)}>
            Fechar caixa
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Estornos são feitos na lista de pagamentos.
          </p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vendas"
          value={brl(vendas)}
          hint={
            sessao.totalEstornos > 0
              ? `Já descontados ${brl(sessao.totalEstornos)} em estornos`
              : undefined
          }
          icon={Receipt}
        />
        <KpiCard label={METODO_LABEL.DINHEIRO} value={brl(sessao.totalDinheiro)} icon={Banknote} />
        <KpiCard label={METODO_LABEL.PIX} value={brl(sessao.totalPix)} icon={QrCode} />
        <KpiCard
          label="Cartões"
          value={brl(sessao.totalDebito + sessao.totalCredito)}
          hint={`${METODO_LABEL.DEBITO} ${brl(sessao.totalDebito)} · ${METODO_LABEL.CREDITO} ${brl(sessao.totalCredito)}`}
          icon={CreditCard}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Movimentacoes
          sessaoId={sessao.id}
          quantidade={sessao.movimentacoes}
          className="lg:col-span-3"
        />
        <Secao titulo="Vendas por forma de pagamento" className="lg:col-span-2">
          <ul className="space-y-4">
            {porForma.map((f) => {
              const parte = vendas > 0 ? Math.max(0, Math.min(100, (f.valor / vendas) * 100)) : 0;
              return (
                <li key={f.rotulo} className="space-y-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground">{f.rotulo}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {brl(f.valor)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
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
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Pagamentos sessaoId={sessao.id} className="lg:col-span-3" />
        <AReceber className="lg:col-span-2" />
      </div>

      <Fechamentos />

      <DialogoMovimento
        tipo={movimento}
        dinheiroEsperado={sessao.dinheiroEsperado}
        aoFechar={() => setMovimento(null)}
      />
      <DialogoFechamento sessao={sessao} aberto={fechando} aoFechar={() => setFechando(false)} />
    </>
  );
}

function AReceber({ className }: { className?: string }) {
  const pedidos = usePedidosAReceber();
  const [recebendo, setRecebendo] = useState<PedidoAReceber | null>(null);

  return (
    <Secao titulo="Balcão a receber" className={className}>
      {pedidos.isPending ? (
        <LoadingState label="Carregando pedidos…" />
      ) : pedidos.isError ? (
        <ErrorState
          description="Não foi possível carregar os pedidos a receber."
          onRetry={() => void pedidos.refetch()}
        />
      ) : pedidos.data.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nenhum pedido de balcão em aberto.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {pedidos.data.map((p) => {
            const saldo = p.total - p.valorPago;
            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Pedido #{p.numero}</p>
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
      )}

      <DialogoPagamento
        aberto={!!recebendo}
        aoMudarAberto={(aberto) => !aberto && setRecebendo(null)}
        titulo={`Receber pedido #${recebendo?.numero ?? ""}`}
        saldo={recebendo ? recebendo.total - recebendo.valorPago : 0}
        alvo={recebendo ? { pedidoId: recebendo.id } : null}
      />
    </Secao>
  );
}

function Pagamentos({ sessaoId, className }: { sessaoId: string; className?: string }) {
  const { papel } = useEmpresaAtual();
  const pagamentos = usePagamentos(sessaoId);
  const { estornar } = useCaixaMutations();
  const [estornando, setEstornando] = useState<PagamentoCaixa | null>(null);

  // Nota: controla apenas a interface; `estornar_pagamento` valida o papel.
  const podeEstornar = papel === "owner" || papel === "admin";

  return (
    <Secao titulo="Pagamentos" className={className}>
      {pagamentos.isPending ? (
        <LoadingState label="Carregando pagamentos…" />
      ) : pagamentos.isError ? (
        <ErrorState
          description="Não foi possível carregar os pagamentos."
          onRetry={() => void pagamentos.refetch()}
        />
      ) : pagamentos.data.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nenhum pagamento nesta sessão.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {pagamentos.data.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 py-3",
                p.status === "ESTORNADO" && "opacity-70",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {p.pedidoNumero !== null
                    ? `Pedido #${p.pedidoNumero}`
                    : `Comanda ${p.comandaNumero ?? ""}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {time(p.criadoEm)} · {METODO_LABEL[p.metodo]}
                  {p.troco !== null && p.troco > 0 && ` · troco ${brl(p.troco)}`}
                </p>
              </div>
              <span
                className={cn(
                  "font-semibold text-foreground tabular-nums",
                  p.status === "ESTORNADO" && "line-through",
                )}
              >
                {brl(p.valor)}
              </span>
              {p.status === "ESTORNADO" ? (
                <StatusBadge tone="danger" className="w-fit">
                  Estornado
                </StatusBadge>
              ) : (
                podeEstornar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                    onClick={() => setEstornando(p)}
                  >
                    Estornar
                  </Button>
                )
              )}
              {p.motivoEstorno && (
                <span className="basis-full text-xs text-muted-foreground">
                  Motivo: {p.motivoEstorno}
                </span>
              )}
            </li>
          ))}
        </ul>
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

function Movimentacoes({
  sessaoId,
  quantidade,
  className,
}: {
  sessaoId: string;
  quantidade: number;
  className?: string;
}) {
  const movimentacoes = useMovimentacoes(sessaoId);

  return (
    <Secao
      titulo="Movimentações"
      className={className}
      extra={<span className="text-xs text-muted-foreground tabular-nums">{quantidade}</span>}
    >
      {movimentacoes.isPending ? (
        <LoadingState label="Carregando movimentações…" />
      ) : movimentacoes.isError ? (
        <ErrorState
          description="Não foi possível carregar as movimentações."
          onRetry={() => void movimentacoes.refetch()}
        />
      ) : (
        <ul className="divide-y divide-border text-sm">
          {movimentacoes.data.map((m) => {
            const { label, saida } = TIPO_MOVIMENTACAO[m.tipo];
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
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
          })}
        </ul>
      )}
    </Secao>
  );
}

function Fechamentos() {
  const fechamentos = useFechamentos();

  return (
    <Secao titulo="Fechamentos anteriores">
      {fechamentos.isPending ? (
        <LoadingState label="Carregando histórico…" />
      ) : fechamentos.isError ? (
        <ErrorState
          description="Não foi possível carregar o histórico."
          onRetry={() => void fechamentos.refetch()}
        />
      ) : fechamentos.data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sem histórico"
          description="Os caixas fechados aparecerão aqui."
        />
      ) : (
        <ul className="divide-y divide-border text-sm">
          {fechamentos.data.map((c) => {
            const dif = c.diferenca ?? 0;
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Caixa {c.numero} · {c.nomeFechamento ?? c.nomeAbertura}
                  </p>
                  {c.fechadaEm && (
                    <p className="text-xs text-muted-foreground">{dateTime(c.fechadaEm)}</p>
                  )}
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
  return (
    <Dialog open={!!tipo} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo === "SANGRIA" ? "Sangria" : "Suprimento"}</DialogTitle>
          <DialogDescription>
            {tipo === "SANGRIA"
              ? `Retirada de dinheiro da gaveta. Disponível: ${brl(dinheiroEsperado)}.`
              : "Entrada de dinheiro na gaveta, por exemplo para reforçar o troco."}
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
            Caixa {sessao.numero}. Conte o dinheiro da gaveta. Depois de fechado, o caixa não pode
            mais ser alterado.
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
            Resumo do turno
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Dinheiro esperado</span>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {brl(sessao.dinheiroEsperado)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contado">Dinheiro informado</Label>
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
