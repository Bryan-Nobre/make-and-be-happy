import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Receipt, Wallet } from "lucide-react";
import { useState } from "react";

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
  useRealtimeCaixa,
  useSessaoAberta,
} from "@/hooks/use-caixa";
import { brl, dateTime, time } from "@/lib/format";
import { TIPO_MOVIMENTACAO } from "@/lib/labels";
import { cn } from "@/lib/utils";
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

function Caixa() {
  useRealtimeCaixa();
  const sessao = useSessaoAberta();

  if (sessao.isPending) return <LoadingState label="Carregando caixa…" />;
  if (sessao.isError) {
    return (
      <ErrorState
        description="Não foi possível carregar o caixa."
        onRetry={() => void sessao.refetch()}
      />
    );
  }

  if (!sessao.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Caixa" description="O caixa está fechado." />
        <AbrirCaixa />
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
  const [requisicaoId] = useState(() => crypto.randomUUID());
  const valido = valor !== "" && valor >= 0;

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        abrir.mutate({ valorInicial: Number(valor), observacao, requisicaoId });
      }}
    >
      <h2 className="font-semibold">Abrir caixa</h2>
      <div className="space-y-1.5">
        <Label htmlFor="fundo">Fundo de troco</Label>
        <MoneyInput id="fundo" value={valor} onChange={setValor} autoFocus />
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
      <Button type="submit" className="h-11 w-full" disabled={!valido || abrir.isPending}>
        {abrir.isPending ? "Abrindo…" : "Abrir caixa"}
      </Button>
    </form>
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
    <div className="space-y-6">
      <PageHeader
        title={`Caixa ${sessao.numero}`}
        description={`Aberto por ${sessao.nomeAbertura} em ${dateTime(sessao.abertaEm)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setMovimento("SUPRIMENTO")}>
              Suprimento
            </Button>
            <Button variant="outline" onClick={() => setMovimento("SANGRIA")}>
              Sangria
            </Button>
            <Button variant="destructive" onClick={() => setFechando(true)}>
              Fechar caixa
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Fundo inicial" value={brl(sessao.valorInicial)} icon={Wallet} />
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
        <KpiCard
          label="Dinheiro esperado"
          value={brl(sessao.dinheiroEsperado)}
          hint={`Suprimentos ${brl(sessao.suprimentos)} · Sangrias ${brl(sessao.sangrias)}`}
          icon={Banknote}
        />
        <KpiCard label="Movimentações" value={String(sessao.movimentacoes)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Por forma de pagamento</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {porForma.map((f) => (
              <li key={f.rotulo} className="flex justify-between">
                <span>{f.rotulo}</span>
                <span className="tabular-nums">{brl(f.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
        <AReceber />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Pagamentos sessaoId={sessao.id} />
        <Movimentacoes sessaoId={sessao.id} />
      </div>

      <Fechamentos />

      <DialogoMovimento
        tipo={movimento}
        dinheiroEsperado={sessao.dinheiroEsperado}
        aoFechar={() => setMovimento(null)}
      />
      <DialogoFechamento sessao={sessao} aberto={fechando} aoFechar={() => setFechando(false)} />
    </div>
  );
}

function AReceber() {
  const pedidos = usePedidosAReceber();
  const [recebendo, setRecebendo] = useState<PedidoAReceber | null>(null);

  return (
    <section className="rounded-lg border bg-card p-4 lg:col-span-2">
      <h2 className="font-semibold">Balcão a receber</h2>
      {pedidos.isPending ? (
        <LoadingState className="mt-3" label="Carregando pedidos…" />
      ) : pedidos.isError ? (
        <ErrorState
          className="mt-3"
          description="Não foi possível carregar os pedidos a receber."
          onRetry={() => void pedidos.refetch()}
        />
      ) : pedidos.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido de balcão em aberto.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {pedidos.data.map((p) => {
            const saldo = p.total - p.valorPago;
            return (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="font-medium">#{p.numero}</span>
                <span className="flex-1 text-muted-foreground">
                  {time(p.criadoEm)}
                  {p.valorPago > 0 && ` · pago ${brl(p.valorPago)} de ${brl(p.total)}`}
                </span>
                <span className="tabular-nums font-medium">{brl(saldo)}</span>
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
    </section>
  );
}

function Pagamentos({ sessaoId }: { sessaoId: string }) {
  const { papel } = useEmpresaAtual();
  const pagamentos = usePagamentos(sessaoId);
  const { estornar } = useCaixaMutations();
  const [estornando, setEstornando] = useState<PagamentoCaixa | null>(null);

  // Nota: controla apenas a interface; `estornar_pagamento` valida o papel.
  const podeEstornar = papel === "owner" || papel === "admin";

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Pagamentos</h2>
      {pagamentos.isPending ? (
        <LoadingState className="mt-3" label="Carregando pagamentos…" />
      ) : pagamentos.isError ? (
        <ErrorState
          className="mt-3"
          description="Não foi possível carregar os pagamentos."
          onRetry={() => void pagamentos.refetch()}
        />
      ) : pagamentos.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pagamento nesta sessão.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {pagamentos.data.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 py-2",
                p.status === "ESTORNADO" && "opacity-70",
              )}
            >
              <span className="w-12 text-muted-foreground tabular-nums">{time(p.criadoEm)}</span>
              <span className="flex-1">
                {p.pedidoNumero !== null
                  ? `Pedido #${p.pedidoNumero}`
                  : `Comanda ${p.comandaNumero ?? ""}`}
                <span className="text-muted-foreground"> · {METODO_LABEL[p.metodo]}</span>
                {p.troco !== null && p.troco > 0 && (
                  <span className="text-muted-foreground"> · troco {brl(p.troco)}</span>
                )}
              </span>
              <span className={cn("tabular-nums", p.status === "ESTORNADO" && "line-through")}>
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
                    className="text-destructive"
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
        titulo={`Estornar ${estornando ? brl(estornando.valor) : ""}?`}
        descricao="O valor sai do caixa e volta a ficar em aberto na conta. O motivo fica registrado na auditoria."
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
    </section>
  );
}

function Movimentacoes({ sessaoId }: { sessaoId: string }) {
  const movimentacoes = useMovimentacoes(sessaoId);

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Movimentações</h2>
      {movimentacoes.isPending ? (
        <LoadingState className="mt-3" label="Carregando movimentações…" />
      ) : movimentacoes.isError ? (
        <ErrorState
          className="mt-3"
          description="Não foi possível carregar as movimentações."
          onRetry={() => void movimentacoes.refetch()}
        />
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {movimentacoes.data.map((m) => {
            const { label, saida } = TIPO_MOVIMENTACAO[m.tipo];
            return (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-12 text-muted-foreground tabular-nums">{time(m.criadoEm)}</span>
                <span className="w-24 font-medium">{label}</span>
                <span className="flex-1 truncate text-muted-foreground">
                  {m.descricao}
                  {m.tipo !== "ABERTURA" && ` · ${METODO_LABEL[m.metodo]}`}
                </span>
                <span className={cn("tabular-nums", saida && "text-destructive")}>
                  {saida ? "−" : ""}
                  {brl(m.valor)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Fechamentos() {
  const fechamentos = useFechamentos();

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Fechamentos anteriores</h2>
      {fechamentos.isPending ? (
        <LoadingState className="mt-3" label="Carregando histórico…" />
      ) : fechamentos.isError ? (
        <ErrorState
          className="mt-3"
          description="Não foi possível carregar o histórico."
          onRetry={() => void fechamentos.refetch()}
        />
      ) : fechamentos.data.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Wallet}
            title="Sem histórico"
            description="Os caixas fechados aparecerão aqui."
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {fechamentos.data.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                Caixa {c.numero} · {c.nomeFechamento ?? c.nomeAbertura}
                {c.fechadaEm && ` · ${dateTime(c.fechadaEm)}`}
              </span>
              <span className="tabular-nums">
                Esperado {brl(c.dinheiroEsperado)} · Contado {brl(c.dinheiroInformado ?? 0)} ·{" "}
                <span className={cn((c.diferenca ?? 0) !== 0 && "text-destructive")}>
                  Dif. {brl(c.diferenca ?? 0)}
                </span>
              </span>
              {c.justificativa && (
                <span className="basis-full text-xs text-muted-foreground">
                  Justificativa: {c.justificativa}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const [requisicaoId] = useState(() => crypto.randomUUID());

  const numero = Number(valor || 0);
  const excede = tipo === "SANGRIA" && numero > dinheiroEsperado;
  const valido = numero > 0 && descricao.trim().length >= 3 && !excede;

  return (
    <>
      <form
        id="form-movimento"
        className="space-y-3"
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
          <MoneyInput id="mov-valor" value={valor} onChange={setValor} autoFocus />
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
          Voltar
        </Button>
        <Button type="submit" form="form-movimento" disabled={!valido || movimentar.isPending}>
          {movimentar.isPending ? "Registrando…" : "Registrar"}
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
          <DialogTitle>Fechar caixa {sessao.numero}</DialogTitle>
          <DialogDescription>
            Conte o dinheiro da gaveta. Depois de fechado, o caixa não pode mais ser alterado.
          </DialogDescription>
        </DialogHeader>
        <FormularioFechamento sessao={sessao} aoFechar={aoFechar} />
      </DialogContent>
    </Dialog>
  );
}

function FormularioFechamento({ sessao, aoFechar }: { sessao: SessaoCaixa; aoFechar: () => void }) {
  const { fechar } = useCaixaMutations();
  const [contado, setContado] = useState<number | "">("");
  const [justificativa, setJustificativa] = useState("");

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
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          fechar.mutate(
            { sessaoId: sessao.id, dinheiroInformado: Number(contado), justificativa },
            { onSuccess: aoFechar },
          );
        }}
      >
        <p className="text-sm">
          Dinheiro esperado:{" "}
          <strong className="tabular-nums">{brl(sessao.dinheiroEsperado)}</strong>
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="contado">Valor contado</Label>
          <MoneyInput id="contado" value={contado} onChange={setContado} autoFocus />
        </div>
        {contado !== "" && (
          <p
            className={cn(
              "text-sm font-medium",
              diferenca === 0 ? "text-success" : "text-destructive",
            )}
          >
            Diferença: {brl(diferenca)}
          </p>
        )}
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
          Voltar
        </Button>
        <Button
          type="submit"
          form="form-fechamento"
          variant="destructive"
          disabled={!valido || fechar.isPending}
        >
          {fechar.isPending ? "Fechando…" : "Confirmar fechamento"}
        </Button>
      </DialogFooter>
    </>
  );
}
