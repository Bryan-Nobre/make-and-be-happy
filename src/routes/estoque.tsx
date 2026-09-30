import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { LoadingState } from "@/components/shared/loading-state";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoqueMutations, useItensEstoque, useMovimentacoesEstoque } from "@/hooks/use-estoque";
import { dateTime } from "@/lib/format";
import { STATUS_ESTOQUE, TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";
import {
  formatarQuantidade,
  UNIDADE_NOME,
  type EntradaItemEstoque,
  type ItemEstoque,
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

function Estoque() {
  const itens = useItensEstoque();
  const [form, setForm] = useState<FormItem | null>(null);
  const [movimentando, setMovimentando] = useState<ItemEstoque | null>(null);

  const ativos = (itens.data ?? []).filter((i) => i.ativo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Saldo dos insumos e histórico de movimentações. Vendas baixam o estoque pela ficha técnica do produto."
        actions={
          <Button
            onClick={() =>
              setForm({
                nome: "",
                codigo: "",
                categoria: "",
                unidade: "UN",
                quantidadeMinima: 0,
                saldoInicial: 0,
              })
            }
          >
            <Plus className="size-4" aria-hidden="true" /> Novo item
          </Button>
        }
      />

      {itens.isPending ? (
        <LoadingState label="Carregando estoque…" />
      ) : itens.isError ? (
        <ErrorState
          description="Não foi possível carregar o estoque."
          onRetry={() => void itens.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Itens ativos" value={String(ativos.length)} icon={Boxes} />
            <KpiCard
              label="Estoque baixo"
              value={String(ativos.filter((i) => i.status === "BAIXO").length)}
            />
            <KpiCard
              label="Sem estoque"
              value={String(ativos.filter((i) => i.status === "SEM_ESTOQUE").length)}
            />
          </div>

          <Tabs defaultValue="itens">
            <TabsList>
              <TabsTrigger value="itens">Itens</TabsTrigger>
              <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            </TabsList>
            <TabsContent value="itens">
              <TabelaItens
                itens={itens.data}
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
            <TabsContent value="movimentacoes">
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

function TabelaItens({
  itens,
  aoEditar,
  aoMovimentar,
}: {
  itens: ItemEstoque[];
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
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="h-10 max-w-sm"
          placeholder="Buscar por nome, código ou categoria"
          aria-label="Buscar item de estoque"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          Mostrar desativados
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="p-3">Código</th>
              <th className="p-3">Item</th>
              <th className="p-3">Categoria</th>
              <th className="p-3 text-right">Saldo</th>
              <th className="p-3 text-right">Mínimo</th>
              <th className="p-3">Situação</th>
              <th className="p-3">Ativo</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((i) => (
              <tr key={i.id} className={cn(!i.ativo && "opacity-60")}>
                <td className="p-3 text-muted-foreground">{i.codigo || "—"}</td>
                <td className="p-3 font-medium">{i.nome}</td>
                <td className="p-3">{i.categoria || "—"}</td>
                <td className="p-3 text-right tabular-nums">
                  {formatarQuantidade(i.quantidade, i.unidade)}
                </td>
                <td className="p-3 text-right text-muted-foreground tabular-nums">
                  {formatarQuantidade(i.quantidadeMinima, i.unidade)}
                </td>
                <td className="p-3">
                  <StatusBadge tone={STATUS_ESTOQUE[i.status].tone}>
                    {STATUS_ESTOQUE[i.status].label}
                  </StatusBadge>
                </td>
                <td className="p-3">
                  <Switch
                    checked={i.ativo}
                    onCheckedChange={(ativo) => alternarAtivo.mutate({ id: i.id, ativo })}
                    aria-label={`${i.nome} ativo`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!i.ativo}
                      onClick={() => aoMovimentar(i)}
                    >
                      Movimentar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
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
        {lista.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhum item encontrado.</p>
        )}
      </div>
    </div>
  );
}

function ListaMovimentacoes() {
  const movimentacoes = useMovimentacoesEstoque();

  if (movimentacoes.isPending) return <LoadingState label="Carregando movimentações…" />;
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
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {movimentacoes.data.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <StatusBadge tone={TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].tone}>
              {m.origem === "PEDIDO"
                ? m.variacao < 0
                  ? "Venda"
                  : "Devolução"
                : TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].label}
            </StatusBadge>
            <span className="font-medium">{m.itemNome}</span>
            <span className={cn("tabular-nums", m.variacao < 0 && "text-destructive")}>
              {m.variacao > 0 ? "+" : "−"}
              {formatarQuantidade(Math.abs(m.variacao), m.unidade)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              → {formatarQuantidade(m.saldoResultante, m.unidade)}
            </span>
            <span className="flex-1 text-muted-foreground">
              {m.motivo}
              {m.observacao && ` · ${m.observacao}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {m.nomeMembro ? `${m.nomeMembro} · ` : ""}
              {dateTime(m.criadoEm)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
          <select
            id="item-unidade"
            value={dados.unidade}
            onChange={(e) => campo("unidade", e.target.value as UnidadeEstoque)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {UNIDADE_NOME[u]}
              </option>
            ))}
          </select>
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
