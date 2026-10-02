import { Link } from "@tanstack/react-router";
import { ChefHat, Minus, Plus, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { DialogoMotivo } from "@/components/shared/dialogo-motivo";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { DialogoPagamento } from "@/components/shared/payment-dialog";
import { BotaoCliente, SeletorCliente } from "@/components/shared/seletor-cliente";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSessaoAberta } from "@/hooks/use-caixa";
import {
  useComanda,
  useComandaMutations,
  usePedidoMutations,
  usePedidosDaComanda,
} from "@/hooks/use-pedidos";
import { brl, elapsed } from "@/lib/format";
import { STATUS_MESA, STATUS_PEDIDO } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import { useEmpresaAtual } from "@/providers/empresa";
import type { MesaEstado, PedidoDaComanda } from "@/services/pedidos";

import { VISUAL_MESA, nomeComanda, pessoasTexto } from "./visual";

const PEDIDO_CANCELAVEL = ["DRAFT", "CONFIRMED", "PREPARING"] as const;

export function PainelMesa({
  mesa,
  mesas,
  aoTrocarMesa,
  aoFechar,
}: {
  mesa: MesaEstado;
  mesas: MesaEstado[];
  aoTrocarMesa: (mesaId: string) => void;
  aoFechar: () => void;
}) {
  const temComanda = mesa.comandaId !== null && mesa.comandaNumero !== null;

  return (
    <>
      <DialogHeader className="gap-1 border-b border-dashed border-border px-6 pt-6 pb-5 text-left">
        {temComanda && (
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", VISUAL_MESA[mesa.status].ponto)}
            />
            {nomeComanda(mesa.comandaNumero ?? 0)}
          </p>
        )}
        <DialogTitle className="text-2xl font-bold tracking-tight uppercase">
          {mesa.nome}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {temComanda ? (
            <>
              <span>
                {[
                  mesa.pessoas ? pessoasTexto(mesa.pessoas) : null,
                  mesa.abertaEm ? elapsed(mesa.abertaEm) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {mesa.status === "AGUARDANDO_PAGAMENTO" && (
                <StatusBadge tone={STATUS_MESA[mesa.status].tone}>
                  {STATUS_MESA[mesa.status].label}
                </StatusBadge>
              )}
            </>
          ) : (
            `Mesa disponível · ${mesa.lugares} lugares`
          )}
        </DialogDescription>
      </DialogHeader>
      {mesa.comandaId ? (
        <DetalheComanda
          comandaId={mesa.comandaId}
          mesa={mesa}
          mesas={mesas}
          aoTrocarMesa={aoTrocarMesa}
          aoFechar={aoFechar}
        />
      ) : (
        <AbrirComanda mesa={mesa} />
      )}
    </>
  );
}

function Corpo({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>;
}

function Rodape({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-border bg-card px-6 py-4">{children}</div>;
}

function AbrirComanda({ mesa }: { mesa: MesaEstado }) {
  const { abrir } = useComandaMutations();
  const [pessoas, setPessoas] = useState(() => Math.min(Math.max(mesa.lugares, 1), 2));
  // Uma por abertura de painel: um segundo clique durante a mesma tentativa
  // devolve a comanda já criada em vez de falhar.
  const [requisicaoId] = useState(() => novoUuid());

  const valido = Number.isInteger(pessoas) && pessoas >= 1 && pessoas <= 99;

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) abrir.mutate({ mesaId: mesa.id, pessoas, requisicaoId });
      }}
    >
      <Corpo>
        <div className="space-y-3">
          <label
            htmlFor="pessoas"
            className="block text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase"
          >
            Número de pessoas
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label="Menos uma pessoa"
              disabled={pessoas <= 1}
              onClick={() => setPessoas((p) => Math.max(1, p - 1))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <Input
              id="pessoas"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={pessoas}
              onChange={(e) => setPessoas(Number(e.target.value))}
              className="h-11 flex-1 rounded-xl text-center text-lg font-semibold tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label="Mais uma pessoa"
              disabled={pessoas >= 99}
              onClick={() => setPessoas((p) => Math.min(99, p + 1))}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Corpo>
      <Rodape>
        <Button
          type="submit"
          size="operational"
          className="w-full"
          disabled={!valido || abrir.isPending}
        >
          {abrir.isPending ? "Abrindo…" : "Abrir mesa"}
        </Button>
      </Rodape>
    </form>
  );
}

type ItemConsolidado = {
  chave: string;
  nome: string;
  adicionais: string[];
  quantidade: number;
  total: number;
};

/** Agrupa os itens iguais de todos os pedidos válidos da comanda. */
function consolidarItens(pedidos: PedidoDaComanda[]): ItemConsolidado[] {
  const mapa = new Map<string, ItemConsolidado>();
  for (const p of pedidos) {
    if (p.status === "CANCELLED") continue;
    for (const i of p.itens) {
      const chave = [i.nomeProduto, ...i.adicionais].join("|");
      const atual = mapa.get(chave);
      if (atual) {
        atual.quantidade += i.quantidade;
        atual.total += i.total;
      } else {
        mapa.set(chave, {
          chave,
          nome: i.nomeProduto,
          adicionais: i.adicionais,
          quantidade: i.quantidade,
          total: i.total,
        });
      }
    }
  }
  return [...mapa.values()];
}

function DetalheComanda({
  comandaId,
  mesa,
  mesas,
  aoTrocarMesa,
  aoFechar,
}: {
  comandaId: string;
  mesa: MesaEstado;
  mesas: MesaEstado[];
  aoTrocarMesa: (mesaId: string) => void;
  aoFechar: () => void;
}) {
  const { papel } = useEmpresaAtual();
  const comanda = useComanda(comandaId);
  const pedidos = usePedidosDaComanda(comandaId);
  const acoes = useComandaMutations();
  const [detalhada, setDetalhada] = useState(false);
  const [destino, setDestino] = useState("");
  const [cancelandoComanda, setCancelandoComanda] = useState(false);
  const [recebendo, setRecebendo] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);

  // Nota: estas verificações controlam apenas a interface. As funções do
  // banco validam o papel de quem chama em cada operação.
  const podeEncerrar = papel === "owner" || papel === "admin" || papel === "cashier";
  const podeReceber = podeEncerrar;
  const podeCancelarComanda = papel === "owner" || papel === "admin";
  const sessao = useSessaoAberta({ habilitado: podeReceber });

  if (comanda.isPending || pedidos.isPending) {
    return (
      <Corpo>
        <LoadingState label="Carregando comanda…" />
      </Corpo>
    );
  }
  if (comanda.isError || pedidos.isError || !comanda.data) {
    return (
      <Corpo>
        <ErrorState
          description="Não foi possível carregar a comanda."
          onRetry={() => {
            void comanda.refetch();
            void pedidos.refetch();
          }}
        />
      </Corpo>
    );
  }

  const c = comanda.data;
  const livres = mesas.filter((m) => m.status === "LIVRE");
  const saldo = Math.max(0, c.total - c.valorPago);
  const contaPaga = c.total > 0 && saldo === 0;
  const podeLiberar = saldo === 0 && c.pedidosEmProducao === 0;
  const aberta = c.status === "OPEN";
  const aguardandoPagamento = c.status === "PAYMENT_PENDING" || c.status === "PAID";
  const itens = consolidarItens(pedidos.data);

  return (
    <>
      <Corpo>
        {detalhada ? (
          <>
            <BotaoCliente
              nome={c.nomeCliente}
              disabled={acoes.definirCliente.isPending}
              onClick={() => setEscolhendoCliente(true)}
            />
            <ListaPedidos pedidos={pedidos.data} />
          </>
        ) : (
          <section aria-label="Itens da comanda" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Itens
              </h3>
              {c.nomeCliente && (
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{c.nomeCliente}</span>
                </span>
              )}
            </div>
            {itens.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum pedido lançado.
              </p>
            ) : (
              <ul className="divide-y divide-dashed divide-border border-y border-dashed border-border">
                {itens.map((i) => (
                  <li key={i.chave} className="flex gap-3 py-2.5 text-sm">
                    <span className="w-7 shrink-0 font-semibold text-muted-foreground tabular-nums">
                      {i.quantidade}x
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{i.nome}</span>
                      {i.adicionais.map((a, n) => (
                        <span key={n} className="block text-xs text-muted-foreground">
                          + {a}
                        </span>
                      ))}
                    </span>
                    <span className="shrink-0 font-medium text-foreground tabular-nums">
                      {brl(i.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {c.pedidosEmProducao > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ChefHat className="size-3.5" aria-hidden="true" />
                {c.pedidosEmProducao === 1
                  ? "1 pedido em produção"
                  : `${c.pedidosEmProducao} pedidos em produção`}
              </p>
            )}
          </section>
        )}

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{brl(c.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Serviço ({c.taxaServicoPercentual}%)</dt>
            <dd className="tabular-nums">{brl(c.taxaServico)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <dt className="flex items-center gap-2 text-sm font-semibold tracking-[0.14em] text-foreground uppercase">
              Total
              {contaPaga && <StatusBadge tone="success">Conta paga</StatusBadge>}
            </dt>
            <dd className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {brl(c.total)}
            </dd>
          </div>
          {(c.valorPago > 0 || !aberta) && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>Pago</dt>
                <dd className="text-success tabular-nums">{brl(c.valorPago)}</dd>
              </div>
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 font-semibold",
                  saldo > 0
                    ? "bg-warning-soft text-warning-foreground"
                    : "bg-muted/60 text-foreground",
                )}
              >
                <dt>Falta receber</dt>
                <dd className="text-base tabular-nums">{brl(saldo)}</dd>
              </div>
            </>
          )}
        </dl>

        {detalhada && aberta && (
          <div className="flex gap-2">
            <NativeSelect
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="flex-1"
              aria-label="Mesa de destino"
            >
              <option value="">Transferir para…</option>
              {livres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              disabled={!destino || acoes.transferir.isPending}
              onClick={() =>
                acoes.transferir.mutate(
                  { comandaId: c.id, mesaDestinoId: destino },
                  { onSuccess: () => aoTrocarMesa(destino) },
                )
              }
            >
              Transferir
            </Button>
          </div>
        )}

        {detalhada && podeCancelarComanda && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive-soft hover:text-destructive"
              onClick={() => setCancelandoComanda(true)}
            >
              Cancelar comanda
            </Button>
          </div>
        )}
      </Corpo>

      <Rodape>
        <div className="grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">
          {aberta && (
            <Button asChild variant={c.total === 0 ? "default" : "outline"} className="h-11">
              <Link to="/pedidos" search={{ comanda: c.id }}>
                Adicionar pedido
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11"
            aria-pressed={detalhada}
            onClick={() => setDetalhada((d) => !d)}
          >
            {detalhada ? "Ver resumo" : "Ver comanda"}
          </Button>
        </div>

        {podeEncerrar && podeLiberar ? (
          <Button
            size="operational"
            variant={c.total === 0 ? "outline" : "default"}
            className="w-full"
            disabled={acoes.encerrar.isPending}
            onClick={() => acoes.encerrar.mutate(c.id, { onSuccess: aoFechar })}
          >
            Liberar mesa
          </Button>
        ) : saldo > 0 && podeReceber && sessao.data ? (
          <Button size="operational" className="w-full" onClick={() => setRecebendo(true)}>
            Fechar conta · {brl(saldo)}
          </Button>
        ) : null}

        {saldo > 0 && podeReceber && sessao.isSuccess && !sessao.data && (
          <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            Abra o caixa para fechar esta conta.{" "}
            <Link to="/caixa" className="font-medium text-primary underline">
              Ir para o Caixa
            </Link>
          </p>
        )}
        {saldo > 0 && !podeReceber && (
          <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            O recebimento da conta ({brl(saldo)}) é feito por quem opera o caixa.
          </p>
        )}
        {saldo === 0 && c.total > 0 && c.pedidosEmProducao > 0 && (
          <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            Conta paga. A mesa pode ser liberada quando todos os pedidos forem entregues.
          </p>
        )}

        {(aberta || aguardandoPagamento) && (
          <div className="flex justify-center">
            {aberta ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={acoes.pedirConta.isPending}
                onClick={() => acoes.pedirConta.mutate(c.id)}
              >
                Pedir conta
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={acoes.reabrir.isPending}
                onClick={() => setReabrindo(true)}
              >
                Reabrir comanda
              </Button>
            )}
          </div>
        )}
      </Rodape>

      <SeletorCliente
        aberto={escolhendoCliente}
        atualId={c.clienteId}
        aoFechar={() => setEscolhendoCliente(false)}
        aoEscolher={(escolhido) => {
          setEscolhendoCliente(false);
          acoes.definirCliente.mutate({ comandaId: c.id, clienteId: escolhido?.id ?? null });
        }}
      />

      <DialogoPagamento
        aberto={recebendo}
        aoMudarAberto={setRecebendo}
        titulo={`Receber ${mesa.nome} · comanda ${c.numero}`}
        saldo={saldo}
        alvo={{ comandaId: c.id }}
      />

      <AlertDialog open={reabrindo} onOpenChange={setReabrindo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir a comanda {c.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              A {mesa.nome} volta a aceitar pedidos. O que já foi pago continua registrado e o saldo
              é recalculado com os novos pedidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={acoes.reabrir.isPending}
              onClick={() => acoes.reabrir.mutate(c.id)}
            >
              Reabrir comanda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogoMotivo
        aberto={cancelandoComanda}
        titulo={`Cancelar a comanda ${c.numero}?`}
        descricao={`Os pedidos em aberto serão cancelados e a ${mesa.nome} ficará livre. O motivo fica registrado na auditoria.`}
        confirmando={acoes.cancelar.isPending}
        aoFechar={() => setCancelandoComanda(false)}
        aoConfirmar={(motivo) =>
          acoes.cancelar.mutate({ comandaId: c.id, motivo }, { onSuccess: aoFechar })
        }
      />
    </>
  );
}

function ListaPedidos({ pedidos }: { pedidos: PedidoDaComanda[] }) {
  const { papel } = useEmpresaAtual();
  const { avancar, cancelar } = usePedidoMutations();
  const [cancelando, setCancelando] = useState<PedidoDaComanda | null>(null);

  // Nota: controla apenas a interface; `cancelar_pedido` valida o papel.
  const podeCancelar = (p: PedidoDaComanda) =>
    (PEDIDO_CANCELAVEL as readonly string[]).includes(p.status) &&
    (p.status === "DRAFT" || papel === "owner" || papel === "admin" || papel === "cashier");

  if (pedidos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Nenhum pedido lançado.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-5">
        {pedidos.map((p) => (
          <li key={p.id} className={cn("text-sm", p.status === "CANCELLED" && "opacity-60")}>
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Pedido #{p.numero}
              </span>
              <StatusBadge tone={STATUS_PEDIDO[p.status].tone}>
                {STATUS_PEDIDO[p.status].label}
              </StatusBadge>
            </div>
            <ul className="divide-y divide-dashed divide-border border-y border-dashed border-border">
              {p.itens.map((i) => (
                <li key={i.id} className="flex gap-3 py-3">
                  <span className="w-6 shrink-0 font-semibold text-muted-foreground tabular-nums">
                    {String(i.quantidade).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block font-medium text-foreground",
                        p.status === "CANCELLED" && "line-through",
                      )}
                    >
                      {i.nomeProduto}
                    </span>
                    {i.adicionais.map((a, n) => (
                      <span key={n} className="block text-xs text-muted-foreground">
                        + {a}
                      </span>
                    ))}
                    {i.observacoes?.trim() && (
                      <span className="block text-xs text-muted-foreground italic">
                        {i.observacoes}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-foreground tabular-nums">
                    {brl(i.total)}
                  </span>
                </li>
              ))}
            </ul>
            {p.itens.length > 1 && (
              <div className="flex justify-end pt-2 text-xs text-muted-foreground tabular-nums">
                Total do pedido&nbsp;
                <span className="font-medium text-foreground">{brl(p.total)}</span>
              </div>
            )}
            {(p.status === "READY" || podeCancelar(p)) && (
              <div className="flex gap-2 pt-2">
                {p.status === "READY" && (
                  <Button
                    size="sm"
                    disabled={avancar.isPending}
                    onClick={() => avancar.mutate({ pedidoId: p.id, para: "DELIVERED" })}
                  >
                    Marcar entregue
                  </Button>
                )}
                {podeCancelar(p) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setCancelando(p)}
                  >
                    Cancelar pedido
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <DialogoMotivo
        aberto={!!cancelando}
        titulo={`Cancelar o pedido #${cancelando?.numero ?? ""}?`}
        descricao="A cozinha deixa de ver o pedido. O motivo fica registrado na auditoria."
        confirmando={cancelar.isPending}
        aoFechar={() => setCancelando(null)}
        aoConfirmar={(motivo) => {
          if (!cancelando) return;
          cancelar.mutate(
            { pedidoId: cancelando.id, motivo },
            { onSuccess: () => setCancelando(null) },
          );
        }}
      />
    </>
  );
}
