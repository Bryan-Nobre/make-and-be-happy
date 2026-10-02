import { createFileRoute, Link } from "@tanstack/react-router";
import { Armchair, Check, ChefHat, LayoutGrid, Search, Users } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { DialogoMotivo } from "@/components/shared/dialogo-motivo";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
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

type Filtro = "TODAS" | StatusMesa;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "LIVRE", label: "Livres" },
  { id: "OCUPADA", label: "Ocupadas" },
  { id: "AGUARDANDO_PAGAMENTO", label: "Pagamento" },
];

/** Aparência da mesa física por estado: tampo, cadeiras ocupadas e indicador. */
const VISUAL_MESA: Record<
  StatusMesa,
  { tampo: string; cadeira: string; ponto: string; legenda: string }
> = {
  LIVRE: {
    tampo: "border-border bg-card",
    cadeira: "text-primary",
    ponto: "bg-primary",
    legenda: "border-muted-foreground/40 bg-card",
  },
  OCUPADA: {
    tampo: "border-primary/25 bg-primary-soft shadow-sm",
    cadeira: "text-primary-strong",
    ponto: "bg-primary",
    legenda: "border-primary bg-primary-soft",
  },
  AGUARDANDO_PAGAMENTO: {
    tampo: "border-warning/30 bg-warning-soft shadow-sm",
    cadeira: "text-warning",
    ponto: "bg-warning",
    legenda: "border-warning bg-warning-soft",
  },
};

type Formato = "pequena" | "quadrada" | "retangular";

const formatoDaMesa = (lugares: number): Formato =>
  lugares <= 2 ? "pequena" : lugares <= 4 ? "quadrada" : "retangular";

/** Distribui os lugares em volta do tampo; limitado para não poluir o mapa. */
function distribuirCadeiras(lugares: number) {
  const n = Math.min(Math.max(lugares, 0), 12);
  if (n <= 2) return { topo: 0, direita: n >= 2 ? 1 : 0, base: 0, esquerda: n >= 1 ? 1 : 0 };
  if (n <= 4) return { topo: 1, direita: 1, base: n === 4 ? 1 : 0, esquerda: 1 };
  const meio = n - 2;
  return { topo: Math.ceil(meio / 2), direita: 1, base: Math.floor(meio / 2), esquerda: 1 };
}

function Mesas() {
  useRealtimeSalao();
  const mesas = useMesasEstado();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busca, setBusca] = useState("");

  const lista = mesas.data ?? [];
  const selecionada = lista.find((m) => m.id === selecionadaId) ?? null;

  const contagem = (status: StatusMesa) => lista.filter((m) => m.status === status).length;
  const termo = busca.trim().toLowerCase();
  const visiveis = lista.filter(
    (m) =>
      (filtro === "TODAS" || m.status === filtro) &&
      (termo === "" ||
        m.nome.toLowerCase().includes(termo) ||
        (m.comandaNumero !== null && String(m.comandaNumero).includes(termo))),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mesas" description="Visualize e gerencie as mesas do salão." />

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
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search
                className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-11 rounded-lg pl-10"
                placeholder="Buscar mesa ou comanda..."
                aria-label="Buscar mesa ou comanda"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div
                className="flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-border bg-card p-1"
                role="group"
                aria-label="Filtrar mesas"
              >
                {FILTROS.map((f) => {
                  const ativo = filtro === f.id;
                  const total = f.id === "TODAS" ? lista.length : contagem(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={ativo}
                      aria-label={
                        f.id === "AGUARDANDO_PAGAMENTO"
                          ? `Aguardando pagamento, ${total}`
                          : `${f.label}, ${total}`
                      }
                      onClick={() => setFiltro(f.id)}
                      className={cn(
                        "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                        ativo
                          ? "bg-primary-soft text-primary-strong"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f.label}
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          ativo ? "text-primary-strong/80" : "text-muted-foreground/80",
                        )}
                      >
                        {total}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ul
                className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
                aria-label="Legenda"
              >
                {(Object.keys(STATUS_MESA) as StatusMesa[]).map((status) => (
                  <li key={status} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn("size-3 rounded-full border-2", VISUAL_MESA[status].legenda)}
                    />
                    {STATUS_MESA[status].label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section
            aria-label="Mapa do salão"
            className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8 lg:p-10"
          >
            {visiveis.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nenhuma mesa encontrada"
                description="Ajuste a busca ou o filtro."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12 sm:gap-y-12 lg:gap-x-16">
                {visiveis.map((m) => (
                  <MesaNoSalao key={m.id} mesa={m} aoSelecionar={() => setSelecionadaId(m.id)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={!!selecionada} onOpenChange={(aberto) => !aberto && setSelecionadaId(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
          {selecionada && (
            <PainelMesa
              key={selecionada.id}
              mesa={selecionada}
              mesas={lista}
              aoTrocarMesa={setSelecionadaId}
              aoFechar={() => setSelecionadaId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cadeiras({
  quantidade,
  inicio,
  ocupadas,
  cor,
  lado,
}: {
  quantidade: number;
  inicio: number;
  ocupadas: number;
  cor: string;
  lado: "topo" | "direita" | "base" | "esquerda";
}) {
  if (quantidade === 0) return null;
  const vertical = lado === "esquerda" || lado === "direita";
  const giro = { topo: "rotate-180", direita: "-rotate-90", base: "", esquerda: "rotate-90" }[lado];

  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 justify-center gap-2", vertical ? "flex-col" : "flex-row")}
    >
      {Array.from({ length: quantidade }, (_, n) => (
        <Armchair
          key={n}
          className={cn("size-4", giro, inicio + n < ocupadas ? cor : "text-muted-foreground/50")}
        />
      ))}
    </span>
  );
}

function MesaNoSalao({ mesa, aoSelecionar }: { mesa: MesaEstado; aoSelecionar: () => void }) {
  const visual = VISUAL_MESA[mesa.status];
  const formato = formatoDaMesa(mesa.lugares);
  const cadeiras = distribuirCadeiras(mesa.lugares);
  const ocupadas = mesa.status === "LIVRE" ? 0 : (mesa.pessoas ?? 0);
  const paga = mesa.total > 0 && mesa.valorPago >= mesa.total;
  const valor =
    mesa.status === "AGUARDANDO_PAGAMENTO" && !paga
      ? Math.max(0, mesa.total - mesa.valorPago)
      : mesa.total;

  return (
    <button
      type="button"
      onClick={aoSelecionar}
      aria-label={`${mesa.nome}, ${STATUS_MESA[mesa.status].label}, ${mesa.lugares} lugares`}
      className={cn(
        "group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        formato === "retangular" && "max-sm:col-span-2",
      )}
    >
      <Cadeiras
        lado="topo"
        quantidade={cadeiras.topo}
        inicio={0}
        ocupadas={ocupadas}
        cor={visual.cadeira}
      />
      <span className="flex w-full items-center gap-1.5">
        <Cadeiras
          lado="esquerda"
          quantidade={cadeiras.esquerda}
          inicio={cadeiras.topo + cadeiras.direita + cadeiras.base}
          ocupadas={ocupadas}
          cor={visual.cadeira}
        />
        <span
          className={cn(
            "relative flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md",
            visual.tampo,
            formato === "pequena" && "sm:w-28 lg:w-32",
            formato === "quadrada" && "sm:w-32 lg:w-36",
            formato === "retangular" && "sm:w-48 lg:w-56",
          )}
        >
          {mesa.pedidosEmProducao > 0 && (
            <span
              className="absolute top-2 right-2 flex items-center gap-0.5 text-xs text-muted-foreground"
              title={`${mesa.pedidosEmProducao} em produção`}
            >
              <ChefHat className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{mesa.pedidosEmProducao}</span>
              <span className="sr-only"> em produção</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-foreground uppercase">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", visual.ponto)} />
            {mesa.nome}
          </span>
          {mesa.status === "LIVRE" ? (
            <span className="text-xs text-muted-foreground">Livre</span>
          ) : (
            <>
              {mesa.pessoas !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" aria-hidden="true" />
                  {mesa.pessoas} {mesa.pessoas === 1 ? "pessoa" : "pessoas"}
                </span>
              )}
              <span className="flex items-center gap-1 text-base font-semibold text-foreground tabular-nums">
                {brl(valor)}
                {paga && (
                  <>
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                    <span className="sr-only">conta paga</span>
                  </>
                )}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Comanda {mesa.comandaNumero}
                {mesa.abertaEm && ` · ${elapsed(mesa.abertaEm)}`}
              </span>
            </>
          )}
        </span>
        <Cadeiras
          lado="direita"
          quantidade={cadeiras.direita}
          inicio={cadeiras.topo}
          ocupadas={ocupadas}
          cor={visual.cadeira}
        />
      </span>
      <Cadeiras
        lado="base"
        quantidade={cadeiras.base}
        inicio={cadeiras.topo + cadeiras.direita}
        ocupadas={ocupadas}
        cor={visual.cadeira}
      />
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
  const temComanda = mesa.comandaId !== null && mesa.comandaNumero !== null;

  return (
    <>
      <DialogHeader className="gap-1.5 border-b border-border px-6 pt-6 pb-5 text-left">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", VISUAL_MESA[mesa.status].ponto)}
          />
          {temComanda ? `Comanda #${String(mesa.comandaNumero).padStart(3, "0")}` : "Mesa livre"}
          <span className="sr-only"> · {STATUS_MESA[mesa.status].label}</span>
        </p>
        <DialogTitle className="text-2xl font-bold tracking-tight uppercase">
          {mesa.nome}
        </DialogTitle>
        <DialogDescription>
          {temComanda
            ? [
                mesa.pessoas
                  ? `${mesa.pessoas} ${mesa.pessoas === 1 ? "pessoa" : "pessoas"}`
                  : null,
                mesa.abertaEm ? `aberta há ${elapsed(mesa.abertaEm)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : `${mesa.lugares} lugares`}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 px-6 py-5">
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
      <Button
        type="submit"
        size="operational"
        className="w-full"
        disabled={!valido || abrir.isPending}
      >
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
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);

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
      <BotaoCliente
        nome={c.nomeCliente}
        disabled={acoes.definirCliente.isPending}
        onClick={() => setEscolhendoCliente(true)}
      />
      <SeletorCliente
        aberto={escolhendoCliente}
        atualId={c.clienteId}
        aoFechar={() => setEscolhendoCliente(false)}
        aoEscolher={(escolhido) => {
          setEscolhendoCliente(false);
          acoes.definirCliente.mutate({ comandaId: c.id, clienteId: escolhido?.id ?? null });
        }}
      />

      <ListaPedidos pedidos={pedidos.data} />

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
        {(c.valorPago > 0 || c.status !== "OPEN") && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <dt>Pago</dt>
              <dd className="tabular-nums text-success">{brl(c.valorPago)}</dd>
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

      <div className="space-y-3 border-t border-border pt-5">
        {(c.status === "OPEN" || aguardandoPagamento) && (
          <div className="grid gap-2 sm:grid-cols-2 sm:[&>*:only-child]:col-span-2">
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
          </div>
        )}
        {podeEncerrar && podeLiberar && (
          <Button
            size="operational"
            className="w-full"
            disabled={acoes.encerrar.isPending}
            onClick={() => acoes.encerrar.mutate(c.id, { onSuccess: aoFechar })}
          >
            Liberar mesa
          </Button>
        )}
        {saldo > 0 && podeReceber && sessao.data && (
          <Button size="operational" className="w-full" onClick={() => setRecebendo(true)}>
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

      {podeCancelarComanda && (
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
