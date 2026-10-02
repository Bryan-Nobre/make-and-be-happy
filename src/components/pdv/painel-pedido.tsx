import { Link } from "@tanstack/react-router";
import { Plus, Receipt, Store, UtensilsCrossed, Wallet } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePedido } from "@/hooks/use-pedidos";
import { brl, time } from "@/lib/format";
import type { PedidoDetalhado } from "@/services/pedidos";

import { aguardandoPagamento, numeroPedido, STATUS_OPERACIONAL, STATUS_PAGAMENTO } from "./status";

export function PainelPedido({
  pedidoId,
  podeVerMesas,
  podeReceber,
  caixaAberto,
  comandaAceitaPedidos,
  aoReceber,
  aoAdicionarNaComanda,
  aoNovoPedido,
}: {
  pedidoId: string;
  podeVerMesas: boolean;
  podeReceber: boolean;
  caixaAberto: boolean;
  /** A comanda do pedido ainda está aberta no salão. */
  comandaAceitaPedidos: (comandaId: string) => boolean;
  aoReceber: (pedido: PedidoDetalhado) => void;
  aoAdicionarNaComanda: (comandaId: string) => void;
  aoNovoPedido: () => void;
}) {
  const pedido = usePedido(pedidoId);

  if (pedido.isPending) return <PainelCarregando />;
  if (pedido.isError || !pedido.data) {
    return (
      <div className="p-5">
        <ErrorState
          description={
            pedido.isError ? "Não foi possível carregar o pedido." : "Pedido não encontrado."
          }
          onRetry={pedido.isError ? () => void pedido.refetch() : undefined}
        />
      </div>
    );
  }

  const p = pedido.data;
  const operacional = STATUS_OPERACIONAL[p.status];
  const pagamento = STATUS_PAGAMENTO[p.statusFinanceiro];
  const saldo = Math.max(0, p.total - p.valorPago);
  const naMesa = p.origem === "MESA";
  const local = naMesa ? (p.nomeMesa ?? "Mesa") : "Balcão";
  const comandaAberta = !!p.comandaId && comandaAceitaPedidos(p.comandaId);
  const receberAqui = !naMesa && aguardandoPagamento(p) && podeReceber;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="titulo-painel"
              className="flex items-center gap-2 text-lg font-semibold text-foreground"
            >
              {naMesa ? (
                <UtensilsCrossed className="size-4.5 text-primary-strong" aria-hidden="true" />
              ) : (
                <Store className="size-4.5 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="truncate">{local}</span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              Pedido {numeroPedido(p.numero)} · {time(p.criadoEm)}
            </p>
          </div>
          {p.pessoas !== null && (
            <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
              {p.pessoas} {p.pessoas === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </div>
        {(p.comandaNumero !== null || p.nomeCliente) && (
          <p className="text-sm text-muted-foreground">
            {p.comandaNumero !== null && (
              <span className="tabular-nums">Comanda #{p.comandaNumero}</span>
            )}
            {p.comandaNumero !== null && p.nomeCliente && " · "}
            {p.nomeCliente && <span>{p.nomeCliente}</span>}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Pedido
            </dt>
            <dd className="mt-1">
              <StatusBadge tone={operacional.tone}>{operacional.label}</StatusBadge>
            </dd>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Pagamento
            </dt>
            <dd className="mt-1">
              <StatusBadge tone={pagamento.tone}>{pagamento.label}</StatusBadge>
            </dd>
          </div>
        </dl>
      </div>

      <div className="min-h-32 flex-1 overflow-y-auto px-5">
        <div className="flex items-baseline justify-between pt-4 pb-1">
          <h3 className="text-sm font-semibold text-foreground">Itens</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {p.itens.reduce((soma, i) => soma + i.quantidade, 0)}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {p.itens.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-foreground">
                  <span className="text-muted-foreground tabular-nums">{i.quantidade}x</span>{" "}
                  {i.nomeProduto}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{brl(i.total)}</span>
              </div>
              {i.adicionais.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">+ {i.adicionais.join(" · ")}</p>
              )}
              {i.observacoes && (
                <p className="mt-0.5 text-xs text-foreground">
                  <span className="font-semibold">Obs:</span> {i.observacoes}
                </p>
              )}
            </li>
          ))}
        </ul>
        {p.observacoes && (
          <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
            <span className="font-semibold">Observação do pedido:</span> {p.observacoes}
          </p>
        )}
      </div>

      <div className="border-t border-border p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{brl(p.subtotal)}</dd>
          </div>
          {p.desconto > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Desconto</dt>
              <dd className="text-destructive tabular-nums">− {brl(p.desconto)}</dd>
            </div>
          )}
          {p.acrescimo > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Acréscimo</dt>
              <dd className="tabular-nums">+ {brl(p.acrescimo)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-2 text-foreground">
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-xl font-bold tabular-nums">{brl(p.total)}</dd>
          </div>
          {p.valorPago > 0 && p.status !== "CANCELLED" && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Pago</dt>
              <dd className="tabular-nums">{brl(p.valorPago)}</dd>
            </div>
          )}
          {saldo > 0 && p.status !== "CANCELLED" && p.valorPago > 0 && (
            <div className="flex justify-between font-medium text-foreground">
              <dt>Falta receber</dt>
              <dd className="tabular-nums">{brl(saldo)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 grid gap-2">
          {receberAqui &&
            (caixaAberto ? (
              <Button size="operational" className="w-full" onClick={() => aoReceber(p)}>
                <Wallet aria-hidden="true" />
                Receber {brl(saldo)}
              </Button>
            ) : (
              <>
                <Button size="operational" className="w-full" disabled>
                  <Wallet aria-hidden="true" />
                  Receber {brl(saldo)}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Abra o caixa para receber.{" "}
                  <Link to="/caixa" className="font-medium text-primary-strong hover:underline">
                    Ir para o Caixa
                  </Link>
                </p>
              </>
            ))}
          {!naMesa && aguardandoPagamento(p) && !podeReceber && (
            <p className="text-xs text-muted-foreground">O pagamento é recebido no Caixa.</p>
          )}

          {naMesa && comandaAberta && p.comandaId && (
            <Button
              size="operational"
              className="w-full"
              onClick={() => aoAdicionarNaComanda(p.comandaId ?? "")}
            >
              <Plus aria-hidden="true" />
              Adicionar itens à comanda
            </Button>
          )}
          {naMesa && p.mesaId && podeVerMesas && (
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to="/mesas" search={{ mesa: p.mesaId }}>
                <Receipt aria-hidden="true" />
                {comandaAberta || p.statusComanda === "PAYMENT_PENDING"
                  ? "Ver comanda e fechar conta"
                  : "Ver mesa"}
              </Link>
            </Button>
          )}

          {!receberAqui && !(naMesa && comandaAberta) && (
            <Button size="lg" variant="outline" className="w-full" onClick={aoNovoPedido}>
              <Plus aria-hidden="true" />
              Novo pedido
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PainelCarregando() {
  return (
    <div className="space-y-4 p-5" aria-busy="true" aria-label="Carregando pedido">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-44" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} className="h-10" />
      ))}
    </div>
  );
}
