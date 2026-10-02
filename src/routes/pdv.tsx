import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChefHat,
  Clock,
  Grid2X2,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { DialogoPagamento } from "@/components/shared/payment-dialog";
import {
  BotaoCliente,
  SeletorCliente,
  type ClienteEscolhido,
} from "@/components/shared/seletor-cliente";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSaldoPedido, useSessaoAberta } from "@/hooks/use-caixa";
import { useCategorias, useGruposAdicionais, useProdutos, useSetores } from "@/hooks/use-catalogo";
import { useMesasEstado, usePedidoMutations, useRealtimeSalao } from "@/hooks/use-pedidos";
import { brl } from "@/lib/format";
import { iconeDaCategoria } from "@/lib/icone-categoria";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import { useEmpresaAtual } from "@/providers/empresa";
import type { GrupoAdicional, Produto } from "@/services/catalogo";

export const Route = createFileRoute("/pdv")({
  validateSearch: (search: Record<string, unknown>): { comanda?: string } => {
    const comanda = search["comanda"];
    return typeof comanda === "string" && comanda !== "" ? { comanda } : {};
  },
  head: () => ({
    meta: [
      { title: "PDV — ARVON FOOD" },
      { name: "description", content: "Ponto de venda para pedidos de balcão e mesas." },
      { property: "og:title", content: "PDV — ARVON FOOD" },
      { property: "og:description", content: "Ponto de venda para pedidos de balcão e mesas." },
    ],
  }),
  component: () => (
    <AppLayout module="pdv">
      <Pdv />
    </AppLayout>
  ),
});

type AdicionalEscolhido = { id: string; nome: string; preco: number };

type ItemCarrinho = {
  chave: string;
  produto: Produto;
  quantidade: number;
  observacoes: string;
  adicionais: AdicionalEscolhido[];
};

/** Só para exibição: o banco recalcula tudo a partir do cadastro. */
const totalDoItem = (i: ItemCarrinho) =>
  i.quantidade * (i.produto.preco + i.adicionais.reduce((soma, a) => soma + a.preco, 0));

function Pdv() {
  const { papel } = useEmpresaAtual();
  const { comanda: comandaDaUrl } = Route.useSearch();
  const navigate = useNavigate({ from: "/pdv" });

  useRealtimeSalao();
  const produtos = useProdutos();
  const categorias = useCategorias();
  const setores = useSetores();
  const grupos = useGruposAdicionais();
  const mesas = useMesasEstado();
  const { criar } = usePedidoMutations();

  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [desconto, setDesconto] = useState<number | "">("");
  const [comandaId, setComandaId] = useState(comandaDaUrl ?? "");
  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);
  // Renovada a cada mudança do pedido: repetir o envio do mesmo carrinho
  // (clique duplo, rede instável) não cria um segundo pedido.
  const [requisicaoId, setRequisicaoId] = useState(() => novoUuid());
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);

  // Nota: controla apenas a interface. Quem pode conceder desconto e receber
  // é decidido pelas funções `criar_pedido` e `registrar_pagamento` no banco.
  const podeDescontar = papel === "owner" || papel === "admin" || papel === "cashier";
  const podeReceber = podeDescontar;
  const sessao = useSessaoAberta({ habilitado: podeReceber });
  const saldoCobranca = useSaldoPedido(cobrando);
  const caixaAberto = podeReceber && !!sessao.data;

  const mesasComComanda = useMemo(
    () => (mesas.data ?? []).filter((m) => m.status === "OCUPADA" && m.comandaId),
    [mesas.data],
  );
  const destino = mesasComComanda.find((m) => m.comandaId === comandaId) ?? null;

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const categoriasAtivas = new Set(
      (categorias.data ?? []).filter((c) => c.ativa).map((c) => c.id),
    );
    return (produtos.data ?? []).filter(
      (p) =>
        p.ativo &&
        categoriasAtivas.has(p.categoriaId) &&
        (categoria === "todas" || p.categoriaId === categoria) &&
        (p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)),
    );
  }, [produtos.data, categorias.data, categoria, busca]);

  const setoresInativos = useMemo(
    () => new Set((setores.data ?? []).filter((s) => !s.ativo).map((s) => s.id)),
    [setores.data],
  );
  const vendavel = (p: Produto) =>
    p.disponivel && !(p.setorId !== null && setoresInativos.has(p.setorId));

  const gruposDoProduto = (produto: Produto): GrupoAdicional[] =>
    (grupos.data ?? [])
      .filter((g) => g.ativo && produto.grupoIds.includes(g.id))
      .map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => o.ativo) }));

  const quantidadeNoPedido = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const i of carrinho) mapa.set(i.produto.id, (mapa.get(i.produto.id) ?? 0) + i.quantidade);
    return mapa;
  }, [carrinho]);

  const subtotal = carrinho.reduce((soma, i) => soma + totalDoItem(i), 0);
  const valorDesconto = podeDescontar ? Number(desconto || 0) : 0;
  const total = Math.max(0, subtotal - valorDesconto);

  const mudarPedido = (mudanca: () => void) => {
    mudanca();
    setRequisicaoId(novoUuid());
  };

  const adicionar = (produto: Produto, adicionais: AdicionalEscolhido[] = [], observacoes = "") =>
    mudarPedido(() =>
      setCarrinho((atual) => [
        ...atual,
        { chave: novoUuid(), produto, quantidade: 1, observacoes, adicionais },
      ]),
    );

  const escolher = (produto: Produto) =>
    gruposDoProduto(produto).length ? setEscolhendo(produto) : adicionar(produto);

  const alterarQuantidade = (chave: string, delta: number) =>
    mudarPedido(() =>
      setCarrinho((atual) =>
        atual.map((i) =>
          i.chave === chave ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i,
        ),
      ),
    );

  const remover = (chave: string) =>
    mudarPedido(() => setCarrinho((atual) => atual.filter((i) => i.chave !== chave)));

  const enviar = (receber: boolean) => {
    criar.mutate(
      {
        comandaId: destino?.comandaId ?? null,
        clienteId: destino ? null : (cliente?.id ?? null),
        desconto: valorDesconto,
        requisicaoId,
        itens: carrinho.map((i) => ({
          produtoId: i.produto.id,
          quantidade: i.quantidade,
          observacoes: i.observacoes,
          adicionais: i.adicionais.map((a) => a.id),
        })),
      },
      {
        onSuccess: (pedidoId) => {
          toast.success(
            destino ? `Pedido lançado na ${destino.nome}.` : "Pedido enviado para a cozinha.",
          );
          if (receber) setCobrando(pedidoId);
          setCarrinho([]);
          setDesconto("");
          setComandaId("");
          setCliente(null);
          setRequisicaoId(novoUuid());
          if (comandaDaUrl) void navigate({ search: {} });
        },
      },
    );
  };

  const carregando = produtos.isPending || categorias.isPending || grupos.isPending;
  const erro = produtos.isError || categorias.isError || grupos.isError;

  return (
    <div className="space-y-6">
      <PageHeader title="PDV" description="Monte o pedido e envie para a produção." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-11 rounded-lg pl-10"
              placeholder="Buscar produto..."
              aria-label="Buscar produto por nome ou código"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {carregando ? (
            <LoadingState label="Carregando cardápio…" />
          ) : erro ? (
            <ErrorState
              description="Não foi possível carregar o cardápio."
              onRetry={() => {
                void produtos.refetch();
                void categorias.refetch();
                void grupos.refetch();
              }}
            />
          ) : (
            <>
              <div
                className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2"
                role="group"
                aria-label="Categorias"
              >
                {[
                  { id: "todas", nome: "Todos" },
                  ...(categorias.data ?? []).filter((c) => c.ativa),
                ].map((c) => {
                  const ativa = categoria === c.id;
                  const Icone = c.id === "todas" ? Grid2X2 : iconeDaCategoria(c.nome);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => setCategoria(c.id)}
                      className={cn(
                        "flex h-20 min-w-22 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-3 shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                        ativa
                          ? "border-primary/30 bg-primary-soft text-primary-strong"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      <Icone
                        className={cn(
                          "size-5.5",
                          ativa ? "text-primary-strong" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="max-w-32 truncate text-xs font-semibold">{c.nome}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {lista.map((p) => {
                  const disponivel = vendavel(p);
                  const noPedido = quantidadeNoPedido.get(p.id) ?? 0;
                  const IconeProduto = iconeDaCategoria(
                    (categorias.data ?? []).find((c) => c.id === p.categoriaId)?.nome ?? "",
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!disponivel}
                      onClick={() => escolher(p)}
                      className={cn(
                        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-[transform,box-shadow,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] active:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:shadow-xs",
                        noPedido > 0 ? "border-primary/40" : "border-border",
                      )}
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                        {p.imagemUrl ? (
                          <img
                            src={p.imagemUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover group-disabled:grayscale"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <IconeProduto className="size-8" aria-hidden="true" />
                          </span>
                        )}
                        {noPedido > 0 && (
                          <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-sm tabular-nums">
                            {noPedido}
                            <span className="sr-only"> no pedido</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <span className="flex gap-0.5 text-rating" aria-hidden="true">
                          {[0, 1, 2, 3, 4].map((n) => (
                            <Star key={n} className="size-3 fill-current" />
                          ))}
                        </span>
                        <span className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">
                          {p.nome}
                        </span>
                        {p.descricao.trim() && (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {p.descricao}
                          </span>
                        )}
                        {disponivel ? (
                          <span className="mt-auto pt-1 text-base font-bold text-primary-strong tabular-nums">
                            {brl(p.preco)}
                          </span>
                        ) : (
                          <StatusBadge tone="neutral" className="mt-auto w-fit">
                            Indisponível
                          </StatusBadge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {lista.length === 0 && (
                <EmptyState
                  icon={Search}
                  title="Nenhum produto"
                  description={
                    (produtos.data ?? []).length === 0
                      ? "Cadastre produtos para começar a vender."
                      : "Ajuste a busca ou a categoria."
                  }
                />
              )}
            </>
          )}
        </div>

        <Card
          role="complementary"
          aria-labelledby="pedido-atual"
          className="flex flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
        >
          <div className="space-y-4 border-b p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="pedido-atual" className="text-lg font-semibold text-foreground">
                Pedido atual
              </h2>
              {carrinho.length > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="destino"
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Destino
              </Label>
              <div className="relative">
                {destino ? (
                  <UtensilsCrossed
                    className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-primary-strong"
                    aria-hidden="true"
                  />
                ) : (
                  <Store
                    className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <NativeSelect
                  id="destino"
                  value={destino?.comandaId ?? ""}
                  onChange={(e) => mudarPedido(() => setComandaId(e.target.value))}
                  className="h-12 rounded-lg pl-10 text-base font-medium"
                >
                  <option value="">Balcão</option>
                  {mesasComComanda.map((m) => (
                    <option key={m.id} value={m.comandaId ?? ""}>
                      {m.nome}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {destino && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <StatusBadge tone="success">{destino.nome}</StatusBadge>
                  <span className="tabular-nums">Comanda #{destino.comandaNumero}</span>
                </div>
              )}
            </div>
            {!destino && (
              <BotaoCliente
                nome={cliente?.nome ?? null}
                onClick={() => setEscolhendoCliente(true)}
              />
            )}
          </div>

          <div className="min-h-40 flex-1 px-5 lg:overflow-y-auto">
            {carrinho.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Nenhum item no pedido"
                description="Toque em um produto para adicionar."
                className="h-full border-0 bg-transparent px-0 py-8"
              />
            ) : (
              <ul className="divide-y divide-border">
                {carrinho.map((i) => (
                  <li key={i.chave} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {i.produto.nome}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {brl(totalDoItem(i))}
                      </span>
                    </div>
                    {i.adicionais.length > 0 && (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        + {i.adicionais.map((a) => a.nome).join(" · ")}
                      </p>
                    )}
                    {i.observacoes && (
                      <p className="mt-1 text-[13px] text-foreground">
                        <span className="font-semibold">Obs:</span> {i.observacoes}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => alterarQuantidade(i.chave, -1)}
                        aria-label={`Diminuir ${i.produto.nome}`}
                      >
                        <Minus />
                      </Button>
                      <span className="w-10 text-center text-base font-semibold tabular-nums">
                        {i.quantidade}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => alterarQuantidade(i.chave, 1)}
                        aria-label={`Aumentar ${i.produto.nome}`}
                      >
                        <Plus />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto text-destructive hover:bg-destructive-soft hover:text-destructive"
                        onClick={() => remover(i.chave)}
                        aria-label={`Remover ${i.produto.nome}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t bg-muted/40 p-5">
            {podeDescontar && (
              <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                <Label htmlFor="desconto">Desconto</Label>
                <div className="w-32">
                  <MoneyInput
                    id="desconto"
                    value={desconto}
                    onChange={(valor) => mudarPedido(() => setDesconto(valor))}
                  />
                </div>
              </div>
            )}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{brl(subtotal)}</dd>
              </div>
              {valorDesconto > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Desconto</dt>
                  <dd className="text-destructive tabular-nums">− {brl(valorDesconto)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-3 text-foreground">
                <dt className="text-base font-semibold">Total</dt>
                <dd className="text-xl font-bold tabular-nums">{brl(total)}</dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-2">
              {!destino && caixaAberto ? (
                <>
                  <Button
                    size="operational"
                    className="w-full"
                    disabled={!carrinho.length || criar.isPending}
                    onClick={() => enviar(true)}
                  >
                    {criar.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Wallet aria-hidden="true" />
                    )}
                    {criar.isPending ? "Enviando…" : "Enviar e receber"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    disabled={!carrinho.length || criar.isPending}
                    onClick={() => enviar(false)}
                  >
                    <Clock aria-hidden="true" />
                    Enviar e receber depois
                  </Button>
                </>
              ) : (
                <Button
                  size="operational"
                  className="w-full"
                  disabled={!carrinho.length || criar.isPending}
                  onClick={() => enviar(false)}
                >
                  {criar.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : destino ? (
                    <UtensilsCrossed aria-hidden="true" />
                  ) : (
                    <ChefHat aria-hidden="true" />
                  )}
                  {criar.isPending
                    ? "Enviando…"
                    : destino
                      ? `Lançar na ${destino.nome}`
                      : "Enviar para a cozinha"}
                </Button>
              )}
              {!destino && podeReceber && sessao.isSuccess && !sessao.data && (
                <p className="text-xs text-muted-foreground">
                  O caixa está fechado: o pedido fica a receber até que ele seja aberto.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <DialogoPagamento
        aberto={!!cobrando && !!saldoCobranca.data}
        aoMudarAberto={(aberto) => !aberto && setCobrando(null)}
        aoDesistir={() => {
          if (saldoCobranca.data) {
            toast.info(`Pedido #${saldoCobranca.data.numero} ficou a receber no Caixa.`);
          }
        }}
        titulo={`Receber pedido #${saldoCobranca.data?.numero ?? ""}`}
        saldo={saldoCobranca.data?.saldo ?? 0}
        alvo={cobrando ? { pedidoId: cobrando } : null}
      />

      <SeletorCliente
        aberto={escolhendoCliente}
        atualId={cliente?.id ?? null}
        aoFechar={() => setEscolhendoCliente(false)}
        aoEscolher={(escolhido) => {
          mudarPedido(() => setCliente(escolhido));
          setEscolhendoCliente(false);
        }}
      />
      <DialogoAdicionais
        key={escolhendo?.id ?? "nenhum"}
        produto={escolhendo}
        grupos={escolhendo ? gruposDoProduto(escolhendo) : []}
        aoFechar={() => setEscolhendo(null)}
        aoAdicionar={(adicionais, observacoes) => {
          if (escolhendo) adicionar(escolhendo, adicionais, observacoes);
          setEscolhendo(null);
        }}
      />
    </div>
  );
}

function DialogoAdicionais({
  produto,
  grupos,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto | null;
  grupos: GrupoAdicional[];
  aoFechar: () => void;
  aoAdicionar: (adicionais: AdicionalEscolhido[], observacoes: string) => void;
}) {
  const [selecao, setSelecao] = useState<Record<string, string[]>>({});
  const [observacoes, setObservacoes] = useState("");

  const alternar = (grupo: GrupoAdicional, opcaoId: string) =>
    setSelecao((atual) => {
      const marcadas = atual[grupo.id] ?? [];
      if (marcadas.includes(opcaoId)) {
        return { ...atual, [grupo.id]: marcadas.filter((x) => x !== opcaoId) };
      }
      if (marcadas.length >= grupo.maximo) {
        return grupo.maximo === 1 ? { ...atual, [grupo.id]: [opcaoId] } : atual;
      }
      return { ...atual, [grupo.id]: [...marcadas, opcaoId] };
    });

  const confirmar = () => {
    const faltando = grupos.find((g) => (selecao[g.id]?.length ?? 0) < g.minimo);
    if (faltando) {
      toast.error(
        faltando.minimo === 1
          ? `Escolha uma opção em "${faltando.nome}".`
          : `Escolha pelo menos ${faltando.minimo} opções em "${faltando.nome}".`,
      );
      return;
    }
    const adicionais = grupos.flatMap((g) =>
      g.opcoes
        .filter((o) => selecao[g.id]?.includes(o.id))
        .map((o) => ({ id: o.id, nome: o.nome, preco: o.preco })),
    );
    aoAdicionar(adicionais, observacoes.trim());
  };

  return (
    <Dialog open={!!produto} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto?.nome}</DialogTitle>
          <DialogDescription>Escolha os adicionais do item.</DialogDescription>
        </DialogHeader>
        {grupos.map((g) => (
          <fieldset key={g.id} className="space-y-2">
            <legend className="text-sm font-semibold">
              {g.nome}{" "}
              <span className="font-normal text-muted-foreground">
                {g.minimo > 0 ? "(obrigatório)" : `(até ${g.maximo})`}
              </span>
            </legend>
            {g.opcoes.map((o) => {
              const marcada = selecao[g.id]?.includes(o.id) ?? false;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm",
                    marcada && "border-primary bg-primary-soft",
                  )}
                >
                  <Checkbox checked={marcada} onCheckedChange={() => alternar(g, o.id)} />
                  <span className="flex-1">{o.nome}</span>
                  {o.preco > 0 && (
                    <span className="text-muted-foreground tabular-nums">+ {brl(o.preco)}</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
        <div className="space-y-1">
          <Label htmlFor="observacoes-item">Observação</Label>
          <Textarea
            id="observacoes-item"
            value={observacoes}
            maxLength={200}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: sem cebola"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
