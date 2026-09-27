import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useCategorias, useGruposAdicionais, useProdutos } from "@/hooks/use-catalogo";
import { useMesasEstado, usePedidoMutations, useRealtimeSalao } from "@/hooks/use-pedidos";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const [requisicaoId, setRequisicaoId] = useState(() => crypto.randomUUID());

  // Nota: controla apenas a interface. Quem pode conceder desconto é
  // decidido pela função `criar_pedido` no banco.
  const podeDescontar = papel === "owner" || papel === "admin" || papel === "cashier";

  const mesasComComanda = useMemo(
    () => (mesas.data ?? []).filter((m) => m.status === "OCUPADA" && m.comandaId),
    [mesas.data],
  );
  const destino = mesasComComanda.find((m) => m.comandaId === comandaId) ?? null;

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (produtos.data ?? []).filter(
      (p) =>
        p.ativo &&
        (categoria === "todas" || p.categoriaId === categoria) &&
        (p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)),
    );
  }, [produtos.data, categoria, busca]);

  const gruposDoProduto = (produto: Produto): GrupoAdicional[] =>
    (grupos.data ?? [])
      .filter((g) => g.ativo && produto.grupoIds.includes(g.id))
      .map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => o.ativo) }));

  const subtotal = carrinho.reduce((soma, i) => soma + totalDoItem(i), 0);
  const valorDesconto = podeDescontar ? Number(desconto || 0) : 0;
  const total = Math.max(0, subtotal - valorDesconto);

  const mudarPedido = (mudanca: () => void) => {
    mudanca();
    setRequisicaoId(crypto.randomUUID());
  };

  const adicionar = (produto: Produto, adicionais: AdicionalEscolhido[] = [], observacoes = "") =>
    mudarPedido(() =>
      setCarrinho((atual) => [
        ...atual,
        { chave: crypto.randomUUID(), produto, quantidade: 1, observacoes, adicionais },
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

  const enviar = () => {
    criar.mutate(
      {
        comandaId: destino?.comandaId ?? null,
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
        onSuccess: () => {
          toast.success(
            destino ? `Pedido lançado na ${destino.nome}.` : "Pedido enviado para a cozinha.",
          );
          setCarrinho([]);
          setDesconto("");
          setComandaId("");
          setRequisicaoId(crypto.randomUUID());
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
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar por nome ou código"
              aria-label="Buscar produto"
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
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: "todas", nome: "Todos" },
                  ...(categorias.data ?? []).filter((c) => c.ativa),
                ].map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={categoria === c.id ? "default" : "outline"}
                    onClick={() => setCategoria(c.id)}
                  >
                    {c.nome}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {lista.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.disponivel}
                    onClick={() => escolher(p)}
                    className="flex min-h-24 flex-col justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
                  >
                    <span className="text-sm leading-snug font-medium">{p.nome}</span>
                    <span className="mt-2 text-sm font-semibold text-primary tabular-nums">
                      {p.disponivel ? brl(p.preco) : "Indisponível"}
                    </span>
                  </button>
                ))}
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

        <aside className="flex flex-col rounded-lg border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="border-b p-4">
            <h2 className="font-semibold">Pedido atual</h2>
            <Label htmlFor="destino" className="mt-3 block text-xs text-muted-foreground">
              Destino
            </Label>
            <select
              id="destino"
              value={destino?.comandaId ?? ""}
              onChange={(e) => mudarPedido(() => setComandaId(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Balcão</option>
              {mesasComComanda.map((m) => (
                <option key={m.id} value={m.comandaId ?? ""}>
                  {m.nome} · Comanda {m.comandaNumero}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {carrinho.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Carrinho vazio"
                description="Toque em um produto para adicionar."
              />
            ) : (
              <ul className="space-y-3">
                {carrinho.map((i) => (
                  <li key={i.chave} className="rounded-md border p-2.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{i.produto.nome}</span>
                      <span className="tabular-nums">{brl(totalDoItem(i))}</span>
                    </div>
                    {i.adicionais.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {i.adicionais.map((a) => a.nome).join(", ")}
                      </p>
                    )}
                    {i.observacoes && (
                      <p className="text-xs text-muted-foreground italic">{i.observacoes}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => alterarQuantidade(i.chave, -1)}
                        aria-label={`Diminuir ${i.produto.nome}`}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-8 text-center tabular-nums">{i.quantidade}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => alterarQuantidade(i.chave, 1)}
                        aria-label={`Aumentar ${i.produto.nome}`}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-8 text-destructive"
                        onClick={() => remover(i.chave)}
                        aria-label={`Remover ${i.produto.nome}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3 border-t p-4">
            {podeDescontar && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <Label htmlFor="desconto">Desconto</Label>
                <div className="w-28">
                  <MoneyInput
                    id="desconto"
                    value={desconto}
                    onChange={(valor) => mudarPedido(() => setDesconto(valor))}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{brl(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">{brl(total)}</span>
            </div>
            <Button
              className="h-11 w-full"
              disabled={!carrinho.length || criar.isPending}
              onClick={enviar}
            >
              {criar.isPending
                ? "Enviando…"
                : destino
                  ? `Lançar na ${destino.nome}`
                  : "Enviar para a cozinha"}
            </Button>
          </div>
        </aside>
      </div>

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
