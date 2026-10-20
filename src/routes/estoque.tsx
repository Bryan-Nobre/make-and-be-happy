import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, List, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AcoesBipagem } from "@/components/estoque/acoes-bipagem";
import { DialogoFichaItem } from "@/components/estoque/dialogo-ficha-item";
import { KpisEstoque, type FiltroKpiEstoque } from "@/components/estoque/kpis-estoque";
import {
  fatiaPagina,
  INSUMOS_POR_PAGINA,
  PaginacaoEstoque,
} from "@/components/estoque/paginacao";
import { TransacoesRecentes } from "@/components/estoque/transacoes-recentes";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useEstoqueMutations,
  useItensEstoque,
  useMovimentacoesEstoqueHoje,
} from "@/hooks/use-estoque";
import { STATUS_ESTOQUE, TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import {
  formatarNumeroQuantidade,
  formatarQuantidade,
  UNIDADE_LABEL,
  UNIDADE_NOME,
  type EntradaItemEstoque,
  type ItemEstoque,
  type StatusEstoque,
  type TipoMovimentacaoEstoque,
  type UnidadeEstoque,
} from "@/services/estoque";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Arvon Food" },
      { name: "description", content: "Controle de insumos, entradas, saídas e ajustes." },
      { property: "og:title", content: "Estoque — Arvon Food" },
      { property: "og:description", content: "Controle de insumos, entradas, saídas e ajustes." },
    ],
  }),
  component: () => (
    <AppLayout module="estoque">
      <Estoque />
    </AppLayout>
  ),
});

const UNIDADES = Object.keys(UNIDADE_NOME) as UnidadeEstoque[];
const TIPOS = Object.keys(TIPO_MOVIMENTACAO_ESTOQUE) as TipoMovimentacaoEstoque[];

type FormItem = EntradaItemEstoque & { id?: string; saldoInicial: number; ativo: boolean };

const ITEM_NOVO: FormItem = {
  nome: "",
  codigo: "",
  categoria: "",
  unidade: "UN",
  quantidadeMinima: 0,
  saldoInicial: 0,
  ativo: true,
};

function Estoque() {
  const itens = useItensEstoque();
  const movsHoje = useMovimentacoesEstoqueHoje();
  const [form, setForm] = useState<FormItem | null>(null);
  const [ficha, setFicha] = useState<ItemEstoque | null>(null);
  const [movimentando, setMovimentando] = useState<{
    item: ItemEstoque;
    tipo: TipoMovimentacaoEstoque;
  } | null>(null);
  const [filtrosKpi, setFiltrosKpi] = useState<Set<FiltroKpiEstoque>>(() => new Set());

  /** Mantém a ficha sincronizada após invalidar o cache. */
  const fichaAtual = useMemo(() => {
    if (!ficha) return null;
    return itens.data?.find((i) => i.id === ficha.id) ?? ficha;
  }, [ficha, itens.data]);

  const toggleFiltro = (filtro: FiltroKpiEstoque) => {
    setFiltrosKpi((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(filtro)) proximo.delete(filtro);
      else proximo.add(filtro);
      return proximo;
    });
  };

  const filtroTiposMov = useMemo(() => {
    const tipos: TipoMovimentacaoEstoque[] = [];
    if (filtrosKpi.has("entradas_hoje")) tipos.push("ENTRADA");
    if (filtrosKpi.has("saidas_hoje")) tipos.push("SAIDA");
    if (filtrosKpi.has("ajustes_hoje")) tipos.push("AJUSTE");
    return tipos;
  }, [filtrosKpi]);

  const itensFiltrados = useMemo(() => {
    const base = itens.data ?? [];
    const movs = movsHoje.data ?? [];
    return filtrarItensPorKpis(base, filtrosKpi, movs);
  }, [itens.data, movsHoje.data, filtrosKpi]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Bipe insumos e confira saldos."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/estoque/historico">
                <List className="size-4" aria-hidden="true" />
                <span className="sm:inline">Histórico</span>
              </Link>
            </Button>
            <Button size="sm" onClick={() => setForm(ITEM_NOVO)}>
              <Plus className="size-4" aria-hidden="true" /> Novo item
            </Button>
          </>
        }
      />

      {itens.isPending ? (
        <EstoqueSkeleton />
      ) : itens.isError ? (
        <ErrorState
          description="Não foi possível carregar o estoque."
          onRetry={() => void itens.refetch()}
        />
      ) : (
        <>
          {/* KPIs e extrato: só desktop — no celular o foco é bipar. */}
          <div className="hidden lg:block">
            <KpisEstoque
              itens={itens.data}
              movsHoje={movsHoje.data ?? []}
              selecionados={filtrosKpi}
              onToggle={toggleFiltro}
            />
          </div>

          {/* Altura = coluna direita (scan + 10 transações). Insumos só estica até igualar. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:items-stretch">
            <div className="order-1 flex flex-col gap-4 lg:order-2">
              <AcoesBipagem className="shrink-0" itens={itens.data} />
              <div className="hidden lg:block">
                <TransacoesRecentes filtroTipos={filtroTiposMov} />
              </div>
            </div>

            <div className="order-2 flex h-full min-h-0 flex-col self-stretch rounded-xl border border-border bg-card p-4 shadow-xs lg:order-1">
              <h2 className="mb-3 shrink-0 text-sm font-semibold text-foreground">
                Insumos ({itensFiltrados.length})
              </h2>
              <ListaItens
                itens={itensFiltrados}
                catalogoVazio={itens.data.length === 0}
                aoNovo={() => setForm(ITEM_NOVO)}
                aoAbrir={setFicha}
              />
            </div>
          </div>
        </>
      )}

      <DialogoFichaItem
        item={fichaAtual}
        onFechar={() => setFicha(null)}
        onEditar={(i) => {
          setForm({
            id: i.id,
            nome: i.nome,
            codigo: i.codigo,
            categoria: i.categoria,
            unidade: i.unidade,
            quantidadeMinima: i.quantidadeMinima,
            saldoInicial: 0,
            ativo: i.ativo,
          });
        }}
        onMovimentar={(item, tipo) => setMovimentando({ item, tipo })}
      />
      <DialogoItem form={form} aoFechar={() => setForm(null)} />
      <DialogoMovimento
        item={movimentando?.item ?? null}
        tipoInicial={movimentando?.tipo ?? "ENTRADA"}
        aoFechar={() => setMovimentando(null)}
      />
    </div>
  );
}

function filtrarItensPorKpis(
  itens: ItemEstoque[],
  filtros: ReadonlySet<FiltroKpiEstoque>,
  movsHoje: import("@/services/estoque").MovimentacaoEstoque[],
): ItemEstoque[] {
  if (filtros.size === 0) return itens;

  let lista = itens;

  if (filtros.has("ativos")) {
    lista = lista.filter((i) => i.ativo);
  }

  const status: StatusEstoque[] = [];
  if (filtros.has("baixo")) status.push("BAIXO");
  if (filtros.has("sem_estoque")) status.push("SEM_ESTOQUE");
  if (status.length > 0) {
    const set = new Set(status);
    lista = lista.filter((i) => set.has(i.status));
  }

  const tipos: TipoMovimentacaoEstoque[] = [];
  if (filtros.has("entradas_hoje")) tipos.push("ENTRADA");
  if (filtros.has("saidas_hoje")) tipos.push("SAIDA");
  if (filtros.has("ajustes_hoje")) tipos.push("AJUSTE");
  if (tipos.length > 0) {
    const setTipos = new Set(tipos);
    const nomes = new Set(
      movsHoje.filter((m) => setTipos.has(m.tipo)).map((m) => m.itemNome.toLowerCase()),
    );
    lista = lista.filter((i) => nomes.has(i.nome.toLowerCase()));
  }

  return lista;
}

function EstoqueSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando estoque…</span>
      <div className="hidden gap-3 lg:grid lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl lg:hidden" />
      <LinhasSkeleton />
    </div>
  );
}

function LinhasSkeleton() {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-xs">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="flex items-center gap-4 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-8 w-28 rounded-lg md:block" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

const COR_SALDO: Record<StatusEstoque, string> = {
  NORMAL: "text-foreground",
  BAIXO: "text-warning-foreground",
  SEM_ESTOQUE: "text-destructive",
};

function Saldo({
  quantidade,
  unidade,
  status,
  className,
}: {
  quantidade: number;
  unidade: UnidadeEstoque;
  status: StatusEstoque;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className={cn("font-bold", COR_SALDO[status])}>
        {formatarNumeroQuantidade(quantidade)}
      </span>{" "}
      <span className="text-xs font-medium text-muted-foreground">{UNIDADE_LABEL[unidade]}</span>
    </span>
  );
}

function SeloSituacao({ status }: { status: StatusEstoque }) {
  return (
    <StatusBadge tone={STATUS_ESTOQUE[status].tone}>{STATUS_ESTOQUE[status].label}</StatusBadge>
  );
}

function ListaItens({
  itens,
  catalogoVazio = false,
  aoNovo,
  aoAbrir,
}: {
  itens: ItemEstoque[];
  /** True quando a empresa ainda não tem nenhum item cadastrado. */
  catalogoVazio?: boolean;
  aoNovo: () => void;
  aoAbrir: (item: ItemEstoque) => void;
}) {
  const { alternarAtivo } = useEstoqueMutations();
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [pagina, setPagina] = useState(1);

  const termo = busca.trim().toLowerCase();
  const lista = itens.filter(
    (i) =>
      (mostrarInativos || i.ativo) &&
      (i.nome.toLowerCase().includes(termo) ||
        i.codigo.toLowerCase().includes(termo) ||
        i.categoria.toLowerCase().includes(termo)),
  );
  const paginaAtual = fatiaPagina(lista, pagina, INSUMOS_POR_PAGINA);

  useEffect(() => {
    setPagina(1);
  }, [busca, mostrarInativos, itens]);

  if (catalogoVazio) {
    return (
      <EmptyState
        icon={Boxes}
        title="Nenhum item de estoque"
        description="Cadastre os insumos que você quer controlar, como pães, carnes e bebidas."
        action={
          <Button onClick={aoNovo}>
            <Plus className="size-4" aria-hidden="true" /> Novo item
          </Button>
        }
      />
    );
  }

  const secundario = (i: ItemEstoque) => [i.codigo, i.categoria].filter(Boolean).join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Buscar item, código ou categoria..."
            aria-label="Buscar item de estoque"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="hidden shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Switch
            checked={mostrarInativos}
            onCheckedChange={setMostrarInativos}
            aria-label="Mostrar desativados"
            className="scale-90"
          />
          Desativados
        </label>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum item encontrado"
          description="Ajuste a busca, as KPIs selecionadas ou mostre os desativados."
          className="py-10"
        />
      ) : (
        <>
          {/* Celular: toque abre configurações — bipagem fica no topo. */}
          <ul className="space-y-2 md:hidden">
            {paginaAtual.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => aoAbrir(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-xs transition-colors hover:bg-muted/40",
                    !i.ativo && "opacity-60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{i.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[i.codigo || null, `mín. ${formatarQuantidade(i.quantidadeMinima, i.unidade)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Saldo
                      quantidade={i.quantidade}
                      unidade={i.unidade}
                      status={i.status}
                      className="text-lg"
                    />
                    <div className="mt-1 flex justify-end">
                      <SeloSituacao status={i.status} />
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela cresce no card esticado; 10 por página. */}
          <div className="hidden min-h-0 flex-1 -mx-4 flex-col border-t border-border md:flex">
            <div className="min-h-0 flex-1">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Código</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Categoria</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Mínimo</th>
                    <th className="px-4 py-3 font-medium">Situação</th>
                    <th className="px-4 py-3 font-medium">Ativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginaAtual.map((i) => (
                    <tr
                      key={i.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => aoAbrir(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          aoAbrir(i);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        !i.ativo && "opacity-60",
                      )}
                    >
                      <td className="hidden px-4 py-3.5 text-muted-foreground xl:table-cell">
                        {i.codigo || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-foreground">{i.nome}</p>
                        {secundario(i) && (
                          <p className="text-xs text-muted-foreground xl:hidden">{secundario(i)}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 text-muted-foreground xl:table-cell">
                        {i.categoria || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Saldo
                          quantidade={i.quantidade}
                          unidade={i.unidade}
                          status={i.status}
                          className="text-base"
                        />
                      </td>
                      <td className="hidden px-4 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
                        {formatarQuantidade(i.quantidadeMinima, i.unidade)}
                      </td>
                      <td className="px-4 py-3.5">
                        <SeloSituacao status={i.status} />
                      </td>
                      <td
                        className="px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={i.ativo}
                          onCheckedChange={(ativo) => alternarAtivo.mutate({ id: i.id, ativo })}
                          aria-label={`${i.nome} ativo`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-auto shrink-0 border-t border-border bg-muted/20 px-4">
              <PaginacaoEstoque
                pagina={pagina}
                total={lista.length}
                porPagina={INSUMOS_POR_PAGINA}
                ocultarSeUnica={false}
                onChange={setPagina}
              />
            </div>
          </div>
          <div className="mt-auto border-t border-border bg-muted/20 px-1 md:hidden">
            <PaginacaoEstoque
              pagina={pagina}
              total={lista.length}
              porPagina={INSUMOS_POR_PAGINA}
              ocultarSeUnica={false}
              onChange={setPagina}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

function DialogoItem({ form, aoFechar }: { form: FormItem | null; aoFechar: () => void }) {
  return (
    <Dialog open={!!form} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form?.id ? "Configurações do item" : "Novo item de estoque"}</DialogTitle>
          <DialogDescription>
            {form?.id
              ? "Altere cadastro e status. O saldo só muda com movimentação ou bipagem."
              : "O saldo inicial fica registrado como a primeira entrada do item."}
          </DialogDescription>
        </DialogHeader>
        {form && <FormularioItem inicial={form} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function FormularioItem({ inicial, aoFechar }: { inicial: FormItem; aoFechar: () => void }) {
  const { criar, atualizar, alternarAtivo } = useEstoqueMutations();
  const [dados, setDados] = useState(inicial);
  const [requisicaoId] = useState(() => novoUuid());
  const salvando = criar.isPending || atualizar.isPending || alternarAtivo.isPending;
  const valido =
    dados.nome.trim().length >= 2 && dados.quantidadeMinima >= 0 && dados.saldoInicial >= 0;

  const campo = <K extends keyof FormItem>(chave: K, valor: FormItem[K]) =>
    setDados((atual) => ({ ...atual, [chave]: valor }));

  const salvar = () => {
    if (!valido) return;
    const { id, saldoInicial, ativo, ...entrada } = dados;
    if (id) {
      const concluir = () => {
        if (ativo !== inicial.ativo) {
          alternarAtivo.mutate({ id, ativo }, { onSuccess: aoFechar });
        } else {
          aoFechar();
        }
      };
      atualizar.mutate({ id, ...entrada }, { onSuccess: concluir });
    } else {
      criar.mutate(
        { ...entrada, saldoInicial, requisicaoId },
        { onSuccess: aoFechar },
      );
    }
  };

  return (
    <>
      <form
        id="form-item-estoque"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="item-nome">Nome</Label>
          <Input
            id="item-nome"
            value={dados.nome}
            maxLength={120}
            autoFocus
            onChange={(e) => campo("nome", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-codigo">Código (opcional)</Label>
          <Input
            id="item-codigo"
            value={dados.codigo}
            maxLength={30}
            onChange={(e) => campo("codigo", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-categoria">Categoria (opcional)</Label>
          <Input
            id="item-categoria"
            value={dados.categoria}
            maxLength={60}
            placeholder="Ex.: Carnes"
            onChange={(e) => campo("categoria", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-unidade">Unidade</Label>
          <NativeSelect
            id="item-unidade"
            value={dados.unidade}
            onChange={(e) => campo("unidade", e.target.value as UnidadeEstoque)}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {UNIDADE_NOME[u]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-minimo">Estoque mínimo</Label>
          <InputQuantidade
            id="item-minimo"
            value={dados.quantidadeMinima}
            onChange={(v) => campo("quantidadeMinima", v)}
          />
        </div>
        {!dados.id && (
          <div className="space-y-1.5">
            <Label htmlFor="item-saldo">Saldo inicial</Label>
            <InputQuantidade
              id="item-saldo"
              value={dados.saldoInicial}
              onChange={(v) => campo("saldoInicial", v)}
            />
          </div>
        )}
        {dados.id && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-foreground">Item ativo</p>
              <p className="text-xs text-muted-foreground">Desative para tirar das contagens e da bipagem.</p>
            </div>
            <Switch
              checked={dados.ativo}
              onCheckedChange={(ativo) => campo("ativo", ativo)}
              aria-label="Item ativo"
            />
          </div>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" form="form-item-estoque" disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}

function DialogoMovimento({
  item,
  tipoInicial,
  aoFechar,
}: {
  item: ItemEstoque | null;
  tipoInicial: TipoMovimentacaoEstoque;
  aoFechar: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {TIPO_MOVIMENTACAO_ESTOQUE[tipoInicial].label}: {item?.nome}
          </DialogTitle>
          <DialogDescription>
            Saldo atual: {item ? formatarQuantidade(item.quantidade, item.unidade) : ""}
          </DialogDescription>
        </DialogHeader>
        {item && (
          <FormularioMovimento item={item} tipoInicial={tipoInicial} aoFechar={aoFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormularioMovimento({
  item,
  tipoInicial,
  aoFechar,
}: {
  item: ItemEstoque;
  tipoInicial: TipoMovimentacaoEstoque;
  aoFechar: () => void;
}) {
  const { movimentar } = useEstoqueMutations();
  const [tipo, setTipo] = useState<TipoMovimentacaoEstoque>(tipoInicial);
  const [quantidade, setQuantidade] = useState(tipoInicial === "AJUSTE" ? item.quantidade : 0);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [requisicaoId] = useState(() => novoUuid());

  useEffect(() => {
    setTipo(tipoInicial);
    setQuantidade(tipoInicial === "AJUSTE" ? item.quantidade : 0);
    setMotivo("");
    setObservacao("");
  }, [tipoInicial, item.id, item.quantidade]);

  const saldoApos =
    tipo === "AJUSTE"
      ? quantidade
      : tipo === "ENTRADA"
        ? item.quantidade + quantidade
        : item.quantidade - quantidade;

  const problema = (() => {
    if (tipo !== "AJUSTE" && quantidade <= 0) return "Informe a quantidade.";
    if (tipo === "AJUSTE" && quantidade === item.quantidade)
      return "O saldo contado é igual ao atual.";
    if (saldoApos < 0) return "A saída é maior que o saldo. O estoque não pode ficar negativo.";
    if (motivo.trim().length < 3) return "Informe o motivo.";
    return null;
  })();

  return (
    <>
      <form
        id="form-movimento-estoque"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (problema) return;
          movimentar.mutate(
            { itemId: item.id, tipo, quantidade, motivo, observacao, requisicaoId },
            { onSuccess: aoFechar },
          );
        }}
      >
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de movimentação">
          {TIPOS.map((t) => (
            <Button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              variant={tipo === t ? "default" : "outline"}
              onClick={() => setTipo(t)}
            >
              {TIPO_MOVIMENTACAO_ESTOQUE[t].label}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mov-quantidade">
            {tipo === "AJUSTE" ? "Saldo contado" : "Quantidade"} ({UNIDADE_NOME[item.unidade]})
          </Label>
          <InputQuantidade
            id="mov-quantidade"
            value={quantidade}
            onChange={setQuantidade}
            autoFocus
          />
          <p
            className={cn("text-sm", saldoApos < 0 ? "text-destructive" : "text-muted-foreground")}
          >
            Saldo após: {formatarQuantidade(Math.max(saldoApos, 0), item.unidade)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mov-motivo">Motivo</Label>
          <Input
            id="mov-motivo"
            value={motivo}
            maxLength={200}
            placeholder={
              tipo === "ENTRADA"
                ? "Ex.: compra do fornecedor"
                : tipo === "SAIDA"
                  ? "Ex.: perda por validade"
                  : "Ex.: contagem semanal"
            }
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mov-obs">Observação (opcional)</Label>
          <Input
            id="mov-obs"
            value={observacao}
            maxLength={500}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        {problema && quantidade !== 0 && (
          <p className="text-sm text-destructive" role="alert">
            {problema}
          </p>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="form-movimento-estoque"
          disabled={!!problema || movimentar.isPending}
        >
          {movimentar.isPending ? "Registrando…" : "Registrar"}
        </Button>
      </DialogFooter>
    </>
  );
}

function InputQuantidade({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  value: number;
  onChange: (valor: number) => void;
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      step="0.001"
      min="0"
      autoFocus={autoFocus}
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
