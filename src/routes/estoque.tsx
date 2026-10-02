import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, Boxes, PackageX, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Indicador } from "@/components/shared/indicador";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoqueMutations, useItensEstoque, useMovimentacoesEstoque } from "@/hooks/use-estoque";
import { dateTime } from "@/lib/format";
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
      { title: "Estoque — ARVON FOOD" },
      { name: "description", content: "Controle de insumos, entradas, saídas e ajustes." },
      { property: "og:title", content: "Estoque — ARVON FOOD" },
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

type FormItem = EntradaItemEstoque & { id?: string; saldoInicial: number };

const ITEM_NOVO: FormItem = {
  nome: "",
  codigo: "",
  categoria: "",
  unidade: "UN",
  quantidadeMinima: 0,
  saldoInicial: 0,
};

const GATILHO_ABA =
  "h-8 px-4 data-[state=active]:bg-primary-soft data-[state=active]:text-primary-strong data-[state=active]:shadow-none";

function Estoque() {
  const itens = useItensEstoque();
  const [form, setForm] = useState<FormItem | null>(null);
  const [movimentando, setMovimentando] = useState<ItemEstoque | null>(null);

  const ativos = (itens.data ?? []).filter((i) => i.ativo);
  const baixos = ativos.filter((i) => i.status === "BAIXO").length;
  const zerados = ativos.filter((i) => i.status === "SEM_ESTOQUE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Saldo dos insumos. As vendas dão baixa pela ficha técnica do produto."
        actions={
          <Button onClick={() => setForm(ITEM_NOVO)}>
            <Plus className="size-4" aria-hidden="true" /> Novo item
          </Button>
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Indicador rotulo="Itens ativos" valor={ativos.length} icone={Boxes} tom="neutro" />
            <Indicador
              rotulo="Estoque baixo"
              valor={baixos}
              icone={AlertTriangle}
              tom={baixos > 0 ? "atencao" : "neutro"}
            />
            <Indicador
              rotulo="Sem estoque"
              valor={zerados}
              icone={PackageX}
              tom={zerados > 0 ? "critico" : "neutro"}
            />
          </div>

          <Tabs defaultValue="itens" className="gap-4">
            <TabsList className="h-10 border border-border bg-card">
              <TabsTrigger value="itens" className={GATILHO_ABA}>
                Itens
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className={GATILHO_ABA}>
                Movimentações
              </TabsTrigger>
            </TabsList>
            <TabsContent value="itens" className="mt-4">
              <ListaItens
                itens={itens.data}
                aoNovo={() => setForm(ITEM_NOVO)}
                aoEditar={(i) =>
                  setForm({
                    id: i.id,
                    nome: i.nome,
                    codigo: i.codigo,
                    categoria: i.categoria,
                    unidade: i.unidade,
                    quantidadeMinima: i.quantidadeMinima,
                    saldoInicial: 0,
                  })
                }
                aoMovimentar={setMovimentando}
              />
            </TabsContent>
            <TabsContent value="movimentacoes" className="mt-4">
              <ListaMovimentacoes />
            </TabsContent>
          </Tabs>
        </>
      )}

      <DialogoItem form={form} aoFechar={() => setForm(null)} />
      <DialogoMovimento item={movimentando} aoFechar={() => setMovimentando(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo e estados
// ---------------------------------------------------------------------------

function EstoqueSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando estoque…</span>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-56 rounded-lg" />
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
  aoNovo,
  aoEditar,
  aoMovimentar,
}: {
  itens: ItemEstoque[];
  aoNovo: () => void;
  aoEditar: (item: ItemEstoque) => void;
  aoMovimentar: (item: ItemEstoque) => void;
}) {
  const { alternarAtivo } = useEstoqueMutations();
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const termo = busca.trim().toLowerCase();
  const lista = itens.filter(
    (i) =>
      (mostrarInativos || i.ativo) &&
      (i.nome.toLowerCase().includes(termo) ||
        i.codigo.toLowerCase().includes(termo) ||
        i.categoria.toLowerCase().includes(termo)),
  );

  if (itens.length === 0) {
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
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
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          Mostrar desativados
        </label>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum item encontrado"
          description="Ajuste a busca ou mostre os itens desativados."
          className="py-10"
        />
      ) : (
        <>
          {/* Celular: uma linha operacional por item. */}
          <ul className="space-y-2 md:hidden">
            {lista.map((i) => (
              <li
                key={i.id}
                className={cn(
                  "rounded-xl border border-border bg-card p-4 shadow-xs",
                  !i.ativo && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{i.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[secundario(i), `mín. ${formatarQuantidade(i.quantidadeMinima, i.unidade)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <SeloSituacao status={i.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Saldo
                    quantidade={i.quantidade}
                    unidade={i.unidade}
                    status={i.status}
                    className="text-xl"
                  />
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={i.ativo}
                      onCheckedChange={(ativo) => alternarAtivo.mutate({ id: i.id, ativo })}
                      aria-label={`${i.nome} ativo`}
                      className="mr-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => aoEditar(i)}
                      aria-label={`Editar ${i.nome}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!i.ativo}
                      onClick={() => aoMovimentar(i)}
                    >
                      <ArrowLeftRight className="size-4" aria-hidden="true" />
                      Movimentar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet e desktop: tabela, com colunas secundárias só em telas largas. */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-xs md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Código</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Mínimo</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((i) => (
                  <tr
                    key={i.id}
                    className={cn("transition-colors hover:bg-muted/30", !i.ativo && "opacity-60")}
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
                    <td className="px-4 py-3.5">
                      <Switch
                        checked={i.ativo}
                        onCheckedChange={(ativo) => alternarAtivo.mutate({ id: i.id, ativo })}
                        aria-label={`${i.nome} ativo`}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!i.ativo}
                          onClick={() => aoMovimentar(i)}
                        >
                          <ArrowLeftRight className="size-4" aria-hidden="true" />
                          Movimentar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => aoEditar(i)}
                          aria-label={`Editar ${i.nome}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movimentações
// ---------------------------------------------------------------------------

function ListaMovimentacoes() {
  const movimentacoes = useMovimentacoesEstoque();

  if (movimentacoes.isPending) return <LinhasSkeleton />;
  if (movimentacoes.isError) {
    return (
      <ErrorState
        description="Não foi possível carregar as movimentações."
        onRetry={() => void movimentacoes.refetch()}
      />
    );
  }
  if (movimentacoes.data.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="Sem movimentações"
        description="Entradas, saídas, ajustes e baixas de venda aparecerão aqui."
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Últimas 100 movimentações.</p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm shadow-xs">
        {movimentacoes.data.map((m) => (
          <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5">
            <StatusBadge tone={TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].tone} className="mt-0.5">
              {m.origem === "PEDIDO"
                ? m.variacao < 0
                  ? "Venda"
                  : "Devolução"
                : TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].label}
            </StatusBadge>
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-semibold text-foreground">{m.itemNome}</p>
              <p className="text-xs text-muted-foreground">
                {m.motivo}
                {m.observacao && ` · ${m.observacao}`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m.nomeMembro ? `${m.nomeMembro} · ` : ""}
                {dateTime(m.criadoEm)}
              </p>
            </div>
            <div className="ml-auto text-right whitespace-nowrap tabular-nums">
              <p className={cn("font-bold", m.variacao < 0 ? "text-destructive" : "text-success")}>
                {m.variacao > 0 ? "+" : "−"}
                {formatarQuantidade(Math.abs(m.variacao), m.unidade)}
              </p>
              <p className="text-xs text-muted-foreground">
                saldo {formatarQuantidade(m.saldoResultante, m.unidade)}
              </p>
            </div>
          </li>
        ))}
      </ul>
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
          <DialogTitle>{form?.id ? "Editar item" : "Novo item de estoque"}</DialogTitle>
          <DialogDescription>
            {form?.id
              ? "O saldo não é editado aqui: use Movimentar para registrar entrada, saída ou ajuste."
              : "O saldo inicial fica registrado como a primeira entrada do item."}
          </DialogDescription>
        </DialogHeader>
        {form && <FormularioItem inicial={form} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function FormularioItem({ inicial, aoFechar }: { inicial: FormItem; aoFechar: () => void }) {
  const { criar, atualizar } = useEstoqueMutations();
  const [dados, setDados] = useState(inicial);
  const [requisicaoId] = useState(() => novoUuid());
  const salvando = criar.isPending || atualizar.isPending;
  const valido =
    dados.nome.trim().length >= 2 && dados.quantidadeMinima >= 0 && dados.saldoInicial >= 0;

  const campo = <K extends keyof FormItem>(chave: K, valor: FormItem[K]) =>
    setDados((atual) => ({ ...atual, [chave]: valor }));

  const salvar = () => {
    if (!valido) return;
    const { id, saldoInicial, ...entrada } = dados;
    if (id) {
      atualizar.mutate({ id, ...entrada }, { onSuccess: aoFechar });
    } else {
      criar.mutate({ ...entrada, saldoInicial, requisicaoId }, { onSuccess: aoFechar });
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

function DialogoMovimento({ item, aoFechar }: { item: ItemEstoque | null; aoFechar: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentar: {item?.nome}</DialogTitle>
          <DialogDescription>
            Saldo atual: {item ? formatarQuantidade(item.quantidade, item.unidade) : ""}
          </DialogDescription>
        </DialogHeader>
        {item && <FormularioMovimento item={item} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function FormularioMovimento({ item, aoFechar }: { item: ItemEstoque; aoFechar: () => void }) {
  const { movimentar } = useEstoqueMutations();
  const [tipo, setTipo] = useState<TipoMovimentacaoEstoque>("ENTRADA");
  const [quantidade, setQuantidade] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [requisicaoId] = useState(() => novoUuid());

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
