import { Grid2X2, Minus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategorias, useGruposAdicionais, useProdutos, useSetores } from "@/hooks/use-catalogo";
import { brl } from "@/lib/format";
import { iconeDaCategoria } from "@/lib/icone-categoria";
import { cn } from "@/lib/utils";
import type { Produto } from "@/services/catalogo";

const plural = (n: number) => `${n} ${n === 1 ? "item" : "itens"}`;

export function CatalogoPdv({
  quantidadeDoProduto,
  aoEscolher,
  aoDiminuir,
}: {
  quantidadeDoProduto: (produtoId: string) => number;
  aoEscolher: (produto: Produto) => void;
  aoDiminuir: (produto: Produto) => void;
}) {
  const produtos = useProdutos();
  const categorias = useCategorias();
  const setores = useSetores();
  const grupos = useGruposAdicionais();

  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");

  const categoriasAtivas = useMemo(
    () => (categorias.data ?? []).filter((c) => c.ativa),
    [categorias.data],
  );

  const vendaveisNoCardapio = useMemo(() => {
    const ativas = new Set(categoriasAtivas.map((c) => c.id));
    return (produtos.data ?? []).filter((p) => p.ativo && ativas.has(p.categoriaId));
  }, [produtos.data, categoriasAtivas]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vendaveisNoCardapio.filter(
      (p) =>
        (categoria === "todas" || p.categoriaId === categoria) &&
        (p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)),
    );
  }, [vendaveisNoCardapio, categoria, busca]);

  const setoresInativos = useMemo(
    () => new Set((setores.data ?? []).filter((s) => !s.ativo).map((s) => s.id)),
    [setores.data],
  );
  const vendavel = (p: Produto) =>
    p.disponivel && !(p.setorId !== null && setoresInativos.has(p.setorId));

  const nomeCategoria = (id: string) => categoriasAtivas.find((c) => c.id === id)?.nome ?? "";

  const carregando = produtos.isPending || categorias.isPending || grupos.isPending;
  const erro = produtos.isError || categorias.isError || grupos.isError;

  return (
    <div className="@container min-w-0 space-y-4">
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-11 rounded-lg bg-card pl-10"
          placeholder="Buscar produto por nome ou código..."
          aria-label="Buscar produto por nome ou código"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {carregando ? (
        <CatalogoCarregando />
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
            className="trilho -mx-1 flex gap-2.5 overflow-x-auto px-1 py-1"
            role="group"
            aria-label="Categorias"
          >
            {[
              { id: "todas", nome: "Todos", total: vendaveisNoCardapio.length },
              ...categoriasAtivas.map((c) => ({
                id: c.id,
                nome: c.nome,
                total: vendaveisNoCardapio.filter((p) => p.categoriaId === c.id).length,
              })),
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
                    "flex h-14 shrink-0 cursor-pointer items-center gap-3 rounded-xl border bg-card pr-4 pl-2 text-left shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    ativa
                      ? "border-primary/50 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      ativa
                        ? "bg-primary-soft text-primary-strong"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icone className="size-5" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">
                    <span className="block max-w-32 truncate text-sm font-semibold text-foreground">
                      {c.nome}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {plural(c.total)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum produto"
              description={
                (produtos.data ?? []).length === 0
                  ? "Cadastre produtos para começar a vender."
                  : "Ajuste a busca ou a categoria."
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-4">
              {lista.map((p) => (
                <li key={p.id}>
                  <CardProduto
                    produto={p}
                    categoria={nomeCategoria(p.categoriaId)}
                    disponivel={vendavel(p)}
                    quantidade={quantidadeDoProduto(p.id)}
                    aoEscolher={() => aoEscolher(p)}
                    aoDiminuir={() => aoDiminuir(p)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CardProduto({
  produto: p,
  categoria,
  disponivel,
  quantidade,
  aoEscolher,
  aoDiminuir,
}: {
  produto: Produto;
  categoria: string;
  disponivel: boolean;
  quantidade: number;
  aoEscolher: () => void;
  aoDiminuir: () => void;
}) {
  const IconeProduto = iconeDaCategoria(categoria);

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow]",
        quantidade > 0 ? "border-primary/60 ring-1 ring-primary/25" : "border-border",
        !disponivel && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={!disponivel}
        onClick={aoEscolher}
        aria-label={`Adicionar ${p.nome}`}
        className="group flex flex-1 cursor-pointer flex-col text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed"
      >
        <span className="m-2 mb-0 block aspect-[4/3] overflow-hidden rounded-lg bg-muted/70">
          {p.imagemUrl ? (
            <img
              src={p.imagemUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] group-disabled:grayscale"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <IconeProduto className="size-8" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 px-3 pt-2.5">
          <span className="truncate text-xs text-muted-foreground">{categoria}</span>
          <span className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">
            {p.nome}
          </span>
          {p.descricao.trim() && (
            <span className="line-clamp-2 text-xs text-muted-foreground">{p.descricao}</span>
          )}
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-3">
        {disponivel ? (
          <span className="text-sm font-bold text-foreground tabular-nums">{brl(p.preco)}</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">Indisponível</span>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={aoDiminuir}
            disabled={quantidade === 0}
            aria-label={`Diminuir ${p.nome}`}
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-border after:absolute after:-inset-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {quantidade}
            <span className="sr-only"> no pedido</span>
          </span>
          <button
            type="button"
            onClick={aoEscolher}
            disabled={!disponivel}
            aria-label={`Aumentar ${p.nome}`}
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary after:absolute after:-inset-1.5 text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogoCarregando() {
  return (
    <div aria-busy="true" aria-label="Carregando cardápio" className="space-y-4">
      <div className="flex gap-2.5 overflow-hidden">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-14 w-36 shrink-0 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <Skeleton key={n} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
