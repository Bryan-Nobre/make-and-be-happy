import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Users } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { DialogoMotivo } from "@/components/shared/dialogo-motivo";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { DialogoPagamento } from "@/components/shared/payment-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSessaoAberta } from "@/hooks/use-caixa";
import {
  useComanda,
  useComandaMutations,
  useMesasEstado,
  usePedidoMutations,
  usePedidosDaComanda,
  useRealtimeSalao,
} from "@/hooks/use-pedidos";
import { brl, elapsed } from "@/lib/format";
import { STATUS_MESA, STATUS_PEDIDO } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import { useEmpresaAtual } from "@/providers/empresa";
import type { MesaEstado, PedidoDaComanda, StatusMesa } from "@/services/pedidos";

export const Route = createFileRoute("/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas — ARVON FOOD" },
      { name: "description", content: "Mapa de mesas, comandas abertas e fechamento de conta." },
      { property: "og:title", content: "Mesas — ARVON FOOD" },
      {
        property: "og:description",
        content: "Mapa de mesas, comandas abertas e fechamento de conta.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="mesas">
      <Mesas />
    </AppLayout>
  ),
});

const PEDIDO_CANCELAVEL = ["DRAFT", "CONFIRMED", "PREPARING"] as const;

function Mesas() {
  useRealtimeSalao();
  const mesas = useMesasEstado();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const lista = mesas.data ?? [];
  const selecionada = lista.find((m) => m.id === selecionadaId) ?? null;

  const contagem = (status: StatusMesa) => lista.filter((m) => m.status === status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesas"
        description="Toque em uma mesa para abrir a comanda, lançar pedidos ou pedir a conta."
      />

      {mesas.isPending ? (
        <LoadingState label="Carregando mesas…" />
      ) : mesas.isError ? (
        <ErrorState
          description="Não foi possível carregar as mesas."
          onRetry={() => void mesas.refetch()}
        />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma mesa ativa"
          description="Cadastre mesas em Configurações para usar o salão."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_MESA) as StatusMesa[]).map((status) => (
              <StatusBadge key={status} tone={STATUS_MESA[status].tone}>
                {STATUS_MESA[status].label}: {contagem(status)}
              </StatusBadge>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {lista.map((m) => (
              <CartaoMesa key={m.id} mesa={m} aoSelecionar={() => setSelecionadaId(m.id)} />
            ))}
          </div>
        </>
      )}

      <Sheet open={!!selecionada} onOpenChange={(aberto) => !aberto && setSelecionadaId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selecionada && (
            <PainelMesa
              key={selecionada.id}
              mesa={selecionada}
              mesas={lista}
              aoTrocarMesa={setSelecionadaId}
              aoFechar={() => setSelecionadaId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CartaoMesa({ mesa, aoSelecionar }: { mesa: MesaEstado; aoSelecionar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoSelecionar}
      className={cn(
        "flex min-h-32 flex-col rounded-lg border-2 bg-card p-3 text-left transition-colors hover:border-primary",
        mesa.status === "OCUPADA" && "border-primary/40 bg-primary-soft",
        mesa.status === "AGUARDANDO_PAGAMENTO" && "border-warning/50 bg-warning-soft",
      )}
    >
      <span className="text-lg font-bold">{mesa.nome}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden="true" />
        {mesa.pessoas ?? 0}/{mesa.lugares}
      </span>
      <span className="mt-auto pt-2">
        {mesa.status === "LIVRE" ? (
          <span className="text-sm text-muted-foreground">Livre</span>
        ) : (
          <>
            <span className="block text-sm font-semibold tabular-nums">
              {brl(mesa.total)}
              {mesa.total > 0 && mesa.valorPago >= mesa.total && (
                <span className="ml-1 text-xs font-medium text-success">· paga</span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              Comanda {mesa.comandaNumero}
              {mesa.abertaEm && ` · ${elapsed(mesa.abertaEm)}`}
            </span>
            {mesa.pedidosEmProducao > 0 && (
              <span className="block text-xs text-muted-foreground">
                {mesa.pedidosEmProducao} em produção
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}

function PainelMesa({
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
  return (
    <>
      <SheetHeader>
        <SheetTitle>{mesa.nome}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes da mesa e da comanda</SheetDescription>
        <StatusBadge tone={STATUS_MESA[mesa.status].tone} className="w-fit">
          {STATUS_MESA[mesa.status].label}
        </StatusBadge>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
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
      </div>
    </>
  );
}

function AbrirComanda({ mesa }: { mesa: MesaEstado }) {
  const { abrir } = useComandaMutations();
  const [pessoas, setPessoas] = useState(2);
  // Uma por abertura de painel: um segundo clique durante a mesma tentativa
  // devolve a comanda já criada em vez de falhar.
  const [requisicaoId] = useState(() => novoUuid());

  const valido = Number.isInteger(pessoas) && pessoas >= 1 && pessoas <= 99;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) abrir.mutate({ mesaId: mesa.id, pessoas, requisicaoId });
      }}
    >
      <Label htmlFor="pessoas">Número de pessoas</Label>
      <Input
        id="pessoas"
        type="number"
        min={1}
        max={99}
        value={pessoas}
        onChange={(e) => setPessoas(Number(e.target.value))}
      />
      <Button type="submit" className="h-11 w-full" disabled={!valido || abrir.isPending}>
        {abrir.isPending ? "Abrindo…" : "Abrir comanda"}
      </Button>
    </form>
  );
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
  const [destino, setDestino] = useState("");
  const [cancelandoComanda, setCancelandoComanda] = useState(false);
  const [recebendo, setRecebendo] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  // Nota: estas verificações controlam apenas a interface. As funções do
  // banco validam o papel de quem chama em cada operação.
  const podeEncerrar = papel === "owner" || papel === "admin" || papel === "cashier";
  const podeReceber = podeEncerrar;
  const podeCancelarComanda = papel === "owner" || papel === "admin";
  const sessao = useSessaoAberta({ habilitado: podeReceber });

  if (comanda.isPending || pedidos.isPending) return <LoadingState label="Carregando comanda…" />;
  if (comanda.isError || pedidos.isError || !comanda.data) {
    return (
      <ErrorState
        description="Não foi possível carregar a comanda."
        onRetry={() => {
          void comanda.refetch();
          void pedidos.refetch();
        }}
      />
    );
  }

  const c = comanda.data;
  const livres = mesas.filter((m) => m.status === "LIVRE");
  const saldo = Math.max(0, c.total - c.valorPago);
  const contaPaga = c.total > 0 && saldo === 0;
  const podeLiberar = saldo === 0 && c.pedidosEmProducao === 0;
  const aguardandoPagamento = c.status === "PAYMENT_PENDING" || c.status === "PAID";

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Comanda {c.numero}
        {c.pessoas ? ` · ${c.pessoas} pessoas` : ""} · aberta há {elapsed(c.abertaEm)}
      </p>

      <ListaPedidos pedidos={pedidos.data} />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{brl(c.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Serviço ({c.taxaServicoPercentual}%)</span>
          <span className="tabular-nums">{brl(c.taxaServico)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{brl(c.total)}</span>
        </div>
        {(c.valorPago > 0 || c.status !== "OPEN") && (
          <>
            <div className="flex justify-between text-success">
              <span>Pago</span>
              <span className="tabular-nums">{brl(c.valorPago)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Falta receber</span>
              <span className="tabular-nums">{brl(saldo)}</span>
            </div>
          </>
        )}
        {contaPaga && (
          <StatusBadge tone="success" className="w-fit">
            Conta paga
          </StatusBadge>
        )}
      </div>

      <div className="grid gap-2">
        {c.status === "OPEN" && (
          <>
            <Button asChild variant="outline" className="h-11">
              <Link to="/pdv" search={{ comanda: c.id }}>
                Lançar pedido no PDV
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={acoes.pedirConta.isPending}
              onClick={() => acoes.pedirConta.mutate(c.id)}
            >
              Pedir conta
            </Button>
          </>
        )}
        {aguardandoPagamento && (
          <Button
            variant="outline"
            className="h-11"
            disabled={acoes.reabrir.isPending}
            onClick={() => setReabrindo(true)}
          >
            Reabrir comanda
          </Button>
        )}
        {podeEncerrar && podeLiberar && (
          <Button
            className="h-11"
            disabled={acoes.encerrar.isPending}
            onClick={() => acoes.encerrar.mutate(c.id, { onSuccess: aoFechar })}
          >
            Liberar mesa
          </Button>
        )}
        {saldo > 0 && podeReceber && sessao.data && (
          <Button className="h-11" onClick={() => setRecebendo(true)}>
            Receber {brl(saldo)}
          </Button>
        )}
        {saldo > 0 && podeReceber && sessao.isSuccess && !sessao.data && (
          <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            Abra o caixa para receber esta conta.{" "}
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
      </div>

      <DialogoPagamento
        aberto={recebendo}
        aoMudarAberto={setRecebendo}
        titulo={`Receber ${mesa.nome} · comanda ${c.numero}`}
        saldo={saldo}
        alvo={{ comandaId: c.id }}
      />

      {c.status === "OPEN" && (
        <div className="flex gap-2">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
            aria-label="Mesa de destino"
          >
            <option value="">Transferir para…</option>
            {livres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
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

      {podeCancelarComanda && (
        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => setCancelandoComanda(true)}
        >
          Cancelar comanda
        </Button>
      )}

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
      <p className="rounded-md border p-3 text-sm text-muted-foreground">Nenhum pedido lançado.</p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-md border">
        {pedidos.map((p) => (
          <li
            key={p.id}
            className={cn("space-y-1 p-3 text-sm", p.status === "CANCELLED" && "opacity-60")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">#{p.numero}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{brl(p.total)}</span>
                <StatusBadge tone={STATUS_PEDIDO[p.status].tone}>
                  {STATUS_PEDIDO[p.status].label}
                </StatusBadge>
              </span>
            </div>
            {p.itens.map((i) => (
              <p key={i.id} className="text-muted-foreground">
                {i.quantidade}× {i.nomeProduto}
                {i.adicionais.length > 0 && ` (+ ${i.adicionais.join(", ")})`}
              </p>
            ))}
            {(p.status === "READY" || podeCancelar(p)) && (
              <div className="flex gap-2 pt-1">
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
