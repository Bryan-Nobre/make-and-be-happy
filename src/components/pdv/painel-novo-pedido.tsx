import {
  ChefHat,
  Clock,
  Loader2,
  MessageSquareText,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Ticket,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { MoneyInput } from "@/components/shared/money-input";
import { BotaoCliente } from "@/components/shared/seletor-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useComandaMutations } from "@/hooks/use-pedidos";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import type { MesaEstado } from "@/services/pedidos";

import { totalDoItem, type ItemCarrinho } from "./use-carrinho";
import type { ModoDestino, NovoPedido } from "./use-novo-pedido";

const MODOS: { id: ModoDestino; label: string; icone: typeof Store }[] = [
  { id: "BALCAO", label: "Balcão", icone: Store },
  { id: "MESA", label: "Mesa", icone: UtensilsCrossed },
  { id: "COMANDA", label: "Comanda", icone: Ticket },
];

export function PainelNovoPedido({
  novo,
  caixaAberto,
  avisoCaixaFechado,
  aoEscolherCliente,
  aoEnviar,
}: {
  novo: NovoPedido;
  caixaAberto: boolean;
  avisoCaixaFechado: boolean;
  aoEscolherCliente: () => void;
  aoEnviar: (receber: boolean) => void;
}) {
  const { carrinho, destino } = novo;
  const vazio = carrinho.itens.length === 0;
  const bloqueado = vazio || novo.enviando || novo.faltaDestino;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-4 border-b border-border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-painel" className="text-lg font-semibold text-foreground">
            Novo pedido
          </h2>
          {!vazio && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {carrinho.quantidadeTotal} {carrinho.quantidadeTotal === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Destino do pedido"
          className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
        >
          {MODOS.map((m) => {
            const ativo = novo.modo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => novo.mudarModo(m.id)}
                className={cn(
                  "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  ativo
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icone className="size-4" aria-hidden="true" />
                {m.label}
              </button>
            );
          })}
        </div>

        {novo.modo === "BALCAO" && (
          <BotaoCliente nome={novo.cliente?.nome ?? null} onClick={aoEscolherCliente} />
        )}
        {novo.modo === "MESA" && <EscolhaDeMesa novo={novo} />}
        {novo.modo === "COMANDA" && (
          <div className="space-y-1.5">
            <Label htmlFor="comanda-destino" className="text-xs text-muted-foreground">
              Comanda aberta
            </Label>
            <NativeSelect
              id="comanda-destino"
              value={destino?.comandaId ?? ""}
              onChange={(e) => novo.escolherComanda(e.target.value)}
              className="h-11 rounded-lg"
            >
              <option value="">
                {novo.mesasComComanda.length ? "Escolha a comanda" : "Nenhuma comanda aberta"}
              </option>
              {novo.mesasComComanda.map((m) => (
                <option key={m.id} value={m.comandaId ?? ""}>
                  Comanda #{m.comandaNumero} · {m.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="min-h-32 flex-1 overflow-y-auto px-5">
        {vazio ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhum item no pedido"
            description="Toque em um produto para adicionar."
            className="h-full border-0 bg-transparent px-0 py-8 shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border">
            {carrinho.itens.map((i) => (
              <LinhaCarrinho
                key={i.chave}
                item={i}
                aoAlterar={(delta) => carrinho.alterarQuantidade(i.chave, delta)}
                aoRemover={() => carrinho.remover(i.chave)}
                aoObservar={(texto) => carrinho.definirObservacao(i.chave, texto)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-5">
        {novo.podeDescontar && (
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <Label htmlFor="desconto" className="text-muted-foreground">
              Desconto
            </Label>
            <div className="w-32">
              <MoneyInput id="desconto" value={novo.desconto} onChange={novo.mudarDesconto} />
            </div>
          </div>
        )}
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{brl(carrinho.subtotal)}</dd>
          </div>
          {novo.valorDesconto > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Desconto</dt>
              <dd className="text-destructive tabular-nums">− {brl(novo.valorDesconto)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-2 text-foreground">
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-xl font-bold tabular-nums">{brl(novo.total)}</dd>
          </div>
        </dl>
        {destino && (
          <p className="mt-1 text-xs text-muted-foreground">
            A taxa de serviço da mesa é somada no fechamento da comanda.
          </p>
        )}

        <div className="mt-4 grid gap-2">
          {!destino && novo.modo === "BALCAO" && caixaAberto ? (
            <>
              <Button
                size="operational"
                className="w-full"
                disabled={bloqueado}
                onClick={() => aoEnviar(true)}
              >
                {novo.enviando ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Wallet aria-hidden="true" />
                )}
                {novo.enviando ? "Enviando…" : "Enviar e receber"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                disabled={bloqueado}
                onClick={() => aoEnviar(false)}
              >
                <Clock aria-hidden="true" />
                Enviar e receber depois
              </Button>
            </>
          ) : (
            <Button
              size="operational"
              className="w-full"
              disabled={bloqueado}
              onClick={() => aoEnviar(false)}
            >
              {novo.enviando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : destino ? (
                <UtensilsCrossed aria-hidden="true" />
              ) : (
                <ChefHat aria-hidden="true" />
              )}
              {novo.enviando
                ? "Enviando…"
                : destino
                  ? `Lançar na ${destino.nome}`
                  : novo.faltaDestino
                    ? "Escolha o destino"
                    : "Enviar para a cozinha"}
            </Button>
          )}
          {novo.modo === "BALCAO" && avisoCaixaFechado && (
            <p className="text-xs text-muted-foreground">
              O caixa está fechado: o pedido fica a receber até que ele seja aberto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EscolhaDeMesa({ novo }: { novo: NovoPedido }) {
  const { abrir } = useComandaMutations();
  const [abrindo, setAbrindo] = useState<MesaEstado | null>(null);
  const [pessoas, setPessoas] = useState(2);
  const [requisicaoId, setRequisicaoId] = useState(() => novoUuid());

  const mesas = novo.mesas.data ?? [];

  const tocar = (m: MesaEstado) => {
    if (m.status === "OCUPADA" && m.comandaId) {
      setAbrindo(null);
      novo.escolherComanda(m.comandaId);
    } else if (m.status === "LIVRE") {
      novo.escolherComanda("");
      setAbrindo(m);
      setPessoas(Math.min(Math.max(m.lugares, 1), 2));
      setRequisicaoId(novoUuid());
    }
  };

  const confirmarAbertura = () => {
    if (!abrindo) return;
    abrir.mutate(
      { mesaId: abrindo.id, pessoas, requisicaoId },
      {
        onSuccess: (comandaId) => {
          setAbrindo(null);
          novo.escolherComanda(comandaId);
        },
      },
    );
  };

  if (novo.mesas.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando mesas…</p>;
  }
  if (mesas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma mesa ativa. Cadastre mesas em Configurações.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto" aria-label="Mesas">
        {mesas.map((m) => {
          const escolhida = !!m.comandaId && m.comandaId === novo.destino?.comandaId;
          const marcadaParaAbrir = abrindo?.id === m.id;
          const indisponivel = m.status === "AGUARDANDO_PAGAMENTO";
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={indisponivel}
                onClick={() => tocar(m)}
                aria-pressed={escolhida || marcadaParaAbrir}
                title={indisponivel ? "Conta pedida: reabra a comanda em Mesas." : undefined}
                className={cn(
                  "flex h-14 w-full cursor-pointer flex-col items-center justify-center rounded-lg border px-1 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  escolhida || marcadaParaAbrir
                    ? "border-primary bg-primary-soft text-primary-strong"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <span className="max-w-full truncate text-sm font-semibold">{m.nome}</span>
                <span className="text-[11px] text-muted-foreground">
                  {m.status === "LIVRE"
                    ? "Livre"
                    : m.status === "OCUPADA"
                      ? `Comanda #${m.comandaNumero}`
                      : "Conta pedida"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {abrindo && (
        <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="w-24 space-y-1">
            <Label htmlFor="pessoas-mesa" className="text-xs text-muted-foreground">
              Pessoas
            </Label>
            <Input
              id="pessoas-mesa"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={pessoas}
              onChange={(e) => setPessoas(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="h-10"
            />
          </div>
          <Button className="h-10 flex-1" disabled={abrir.isPending} onClick={confirmarAbertura}>
            {abrir.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Abrir comanda na {abrindo.nome}
          </Button>
        </div>
      )}

      {novo.destino && (
        <p className="text-sm text-muted-foreground">
          Lançando na <span className="font-medium text-foreground">{novo.destino.nome}</span> ·
          Comanda #{novo.destino.comandaNumero}
        </p>
      )}
    </div>
  );
}

function LinhaCarrinho({
  item: i,
  aoAlterar,
  aoRemover,
  aoObservar,
}: {
  item: ItemCarrinho;
  aoAlterar: (delta: number) => void;
  aoRemover: () => void;
  aoObservar: (texto: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(i.observacoes);

  const salvar = () => {
    aoObservar(texto);
    setEditando(false);
  };

  return (
    <li className="py-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums">{i.quantidade}x</span>{" "}
          {i.produto.nome}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{brl(totalDoItem(i))}</span>
      </div>
      {i.adicionais.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          + {i.adicionais.map((a) => a.nome).join(" · ")}
        </p>
      )}
      {editando ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <Input
            autoFocus
            value={texto}
            maxLength={200}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: sem cebola"
            aria-label={`Observação de ${i.produto.nome}`}
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9">
            Salvar
          </Button>
        </form>
      ) : (
        i.observacoes && (
          <p className="mt-0.5 text-xs text-foreground">
            <span className="font-semibold">Obs:</span> {i.observacoes}
          </p>
        )
      )}
      <div className="mt-2 flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          onClick={() => aoAlterar(-1)}
          disabled={i.quantidade <= 1}
          aria-label={`Diminuir ${i.produto.nome}`}
        >
          <Minus aria-hidden="true" />
        </Button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{i.quantidade}</span>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          onClick={() => aoAlterar(1)}
          aria-label={`Aumentar ${i.produto.nome}`}
        >
          <Plus aria-hidden="true" />
        </Button>
        {!editando && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-1 h-8 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setTexto(i.observacoes);
              setEditando(true);
            }}
          >
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {i.observacoes ? "Editar obs." : "Observação"}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-8 text-destructive hover:bg-destructive-soft hover:text-destructive"
          onClick={aoRemover}
          aria-label={`Remover ${i.produto.nome}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
