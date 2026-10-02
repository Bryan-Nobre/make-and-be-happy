import { createFileRoute } from "@tanstack/react-router";
import { Ban, CircleCheck, DollarSign, Percent, Receipt, ShoppingBag } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { Indicador } from "@/components/shared/indicador";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAuditoria,
  useCancelamentos,
  useFormasPagamento,
  useProdutosVendidos,
  useResumoEstoque,
  useResumoVendas,
  useSessoesNoPeriodo,
  useVendasDiarias,
} from "@/hooks/use-relatorios";
import { brl, dateTime } from "@/lib/format";
import { TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { METODO_LABEL } from "@/services/configuracoes";
import { useItensEstoque } from "@/hooks/use-estoque";
import { formatarNumeroQuantidade, formatarQuantidade, UNIDADE_LABEL } from "@/services/estoque";
import { dataNoFuso, somarDias, type Periodo } from "@/services/relatorios";
import type { Json } from "@/types/db";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ARVON FOOD" },
      { name: "description", content: "Vendas, produtos, caixa, estoque e auditoria." },
      { property: "og:title", content: "Relatórios — ARVON FOOD" },
      { property: "og:description", content: "Vendas, produtos, caixa, estoque e auditoria." },
    ],
  }),
  component: () => (
    <AppLayout module="relatorios">
      <Relatorios />
    </AppLayout>
  ),
});

const ATALHOS = [
  { id: "hoje", label: "Hoje", dias: 0 },
  { id: "7", label: "7 dias", dias: 6 },
  { id: "30", label: "30 dias", dias: 29 },
] as const;

const MAX_DIAS = 366;

const GATILHO_ABA =
  "h-8 px-4 data-[state=active]:bg-primary-soft data-[state=active]:text-primary-strong data-[state=active]:shadow-none";

function Relatorios() {
  const hoje = dataNoFuso();
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: hoje, fim: hoje });
  const [rascunho, setRascunho] = useState<Periodo>(periodo);

  const dias =
    (new Date(rascunho.fim).getTime() - new Date(rascunho.inicio).getTime()) / 86_400_000 + 1;
  const rascunhoValido = !!rascunho.inicio && !!rascunho.fim && dias >= 1 && dias <= MAX_DIAS;

  const aplicar = (p: Periodo) => {
    setPeriodo(p);
    setRascunho(p);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Desempenho da operação no período escolhido." />

      <div className="flex flex-wrap items-end gap-3">
        <div
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-card p-1"
          role="group"
          aria-label="Atalhos de período"
        >
          {ATALHOS.map((a) => {
            const p = { inicio: somarDias(hoje, -a.dias), fim: hoje };
            const ativo = p.inicio === periodo.inicio && p.fim === periodo.fim;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => aplicar(p)}
                className={cn(
                  "h-8 cursor-pointer rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  ativo
                    ? "bg-primary-soft text-primary-strong"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (rascunhoValido) aplicar(rascunho);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="periodo-inicio" className="text-xs text-muted-foreground">
              De
            </Label>
            <Input
              id="periodo-inicio"
              type="date"
              className="h-10 w-40"
              max={hoje}
              value={rascunho.inicio}
              onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="periodo-fim" className="text-xs text-muted-foreground">
              Até
            </Label>
            <Input
              id="periodo-fim"
              type="date"
              className="h-10 w-40"
              max={hoje}
              value={rascunho.fim}
              onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value })}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!rascunhoValido}>
            Aplicar
          </Button>
          {!rascunhoValido && (
            <p className="w-full text-xs text-destructive">
              Escolha um período válido de até {MAX_DIAS} dias.
            </p>
          )}
        </form>
      </div>

      <Tabs defaultValue="vendas">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-10 border border-border bg-card">
            <TabsTrigger value="vendas" className={GATILHO_ABA}>
              Vendas
            </TabsTrigger>
            <TabsTrigger value="produtos" className={GATILHO_ABA}>
              Produtos
            </TabsTrigger>
            <TabsTrigger value="caixa" className={GATILHO_ABA}>
              Caixa
            </TabsTrigger>
            <TabsTrigger value="estoque" className={GATILHO_ABA}>
              Estoque
            </TabsTrigger>
            <TabsTrigger value="auditoria" className={GATILHO_ABA}>
              Auditoria
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="vendas" className="mt-4">
          <AbaVendas periodo={periodo} />
        </TabsContent>
        <TabsContent value="produtos" className="mt-4">
          <AbaProdutos periodo={periodo} />
        </TabsContent>
        <TabsContent value="caixa" className="mt-4">
          <AbaCaixa periodo={periodo} />
        </TabsContent>
        <TabsContent value="estoque" className="mt-4">
          <AbaEstoque periodo={periodo} />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <AbaAuditoria periodo={periodo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocos comuns
// ---------------------------------------------------------------------------

type EstadoConsulta = { isPending: boolean; isError: boolean; refetch: () => unknown };

function Carregando({ consultas, children }: { consultas: EstadoConsulta[]; children: ReactNode }) {
  if (consultas.some((c) => c.isError)) {
    return (
      <ErrorState
        description="Não foi possível carregar o relatório."
        onRetry={() => consultas.forEach((c) => void c.refetch())}
      />
    );
  }
  if (consultas.some((c) => c.isPending)) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Carregando relatório…</span>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-24" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Secao({
  titulo,
  extra,
  className,
  children,
}: {
  titulo: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className={cn("rounded-xl border border-border bg-card p-5 shadow-xs", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {extra}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Barra({
  rotulo,
  valor,
  maximo,
  texto,
}: {
  rotulo: string;
  valor: number;
  maximo: number;
  texto: string;
}) {
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-2">
        <span className="truncate text-muted-foreground">{rotulo}</span>
        <span className="font-semibold tabular-nums">{texto}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${maximo > 0 ? (Math.max(valor, 0) / maximo) * 100 : 0}%` }}
        />
      </div>
    </li>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

const TABELA = "w-full text-sm";
const CABECALHO =
  "border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground";
const TH = "px-4 py-3 font-medium whitespace-nowrap";
const TD = "px-4 py-3";

const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

// ---------------------------------------------------------------------------
// Vendas
// ---------------------------------------------------------------------------

function AbaVendas({ periodo }: { periodo: Periodo }) {
  const resumo = useResumoVendas(periodo);
  const diarias = useVendasDiarias(periodo);
  const formas = useFormasPagamento(periodo);
  const cancelamentos = useCancelamentos(periodo);

  return (
    <Carregando consultas={[resumo, diarias, formas, cancelamentos]}>
      {resumo.data && diarias.data && formas.data && cancelamentos.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <Indicador
              rotulo="Faturamento"
              valor={brl(resumo.data.faturamento)}
              dica={
                resumo.data.descontos > 0
                  ? `Descontos: ${brl(resumo.data.descontos)}`
                  : "sem descontos"
              }
              icone={DollarSign}
              tom="primario"
            />
            <Indicador rotulo="Pedidos" valor={resumo.data.pedidos} icone={ShoppingBag} />
            <Indicador rotulo="Ticket médio" valor={brl(resumo.data.ticketMedio)} icone={Receipt} />
            <Indicador
              rotulo="Taxa de serviço"
              valor={brl(resumo.data.taxaServico)}
              dica="fora do faturamento"
              icone={Percent}
            />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-3">
            <Secao titulo="Vendas por dia" className="xl:col-span-2">
              {diarias.data.length === 0 ? (
                <Vazio>Sem vendas no período.</Vazio>
              ) : (
                <ul className="space-y-3">
                  {diarias.data.map((d) => (
                    <Barra
                      key={d.dia}
                      rotulo={`${diaCurto(d.dia)} · ${d.pedidos} ${d.pedidos === 1 ? "pedido" : "pedidos"}`}
                      valor={d.faturamento}
                      maximo={Math.max(...diarias.data.map((x) => x.faturamento))}
                      texto={brl(d.faturamento)}
                    />
                  ))}
                </ul>
              )}
            </Secao>
            <Secao titulo="Formas de pagamento">
              {formas.data.length === 0 ? (
                <Vazio>Nenhum pagamento recebido no período.</Vazio>
              ) : (
                <ul className="space-y-3">
                  {formas.data.map((f) => (
                    <Barra
                      key={f.metodo}
                      rotulo={`${METODO_LABEL[f.metodo]} · ${f.quantidade}`}
                      valor={f.valor}
                      maximo={Math.max(...formas.data.map((x) => x.valor))}
                      texto={brl(f.valor)}
                    />
                  ))}
                </ul>
              )}
            </Secao>
          </div>

          <Secao
            titulo="Cancelamentos"
            extra={
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Ban className="size-3.5" aria-hidden="true" />
                {resumo.data.cancelados} {resumo.data.cancelados === 1 ? "pedido" : "pedidos"} ·{" "}
                <span className="tabular-nums">{brl(resumo.data.valorCancelado)}</span>
              </span>
            }
          >
            {cancelamentos.data.length === 0 ? (
              <Vazio>Nenhum pedido cancelado no período.</Vazio>
            ) : (
              <ul className="-mx-5 divide-y divide-border border-t border-border text-sm">
                {cancelamentos.data.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold">#{c.numero}</span>{" "}
                      <span className="text-muted-foreground">
                        · {c.motivo ?? "Sem motivo registrado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {dateTime(c.canceladoEm)}
                      <span className="text-sm font-semibold text-destructive tabular-nums">
                        {brl(c.total)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      )}
    </Carregando>
  );
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

function AbaProdutos({ periodo }: { periodo: Periodo }) {
  const produtos = useProdutosVendidos(periodo);

  return (
    <Carregando consultas={[produtos]}>
      {produtos.data &&
        (produtos.data.length === 0 ? (
          <Secao titulo="Mais vendidos">
            <Vazio>Nenhum produto vendido no período.</Vazio>
          </Secao>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <table className={TABELA}>
              <thead className={CABECALHO}>
                <tr>
                  <th className={cn(TH, "w-12")}>#</th>
                  <th className={TH}>Produto</th>
                  <th className={cn(TH, "text-right")}>Quantidade</th>
                  <th className={cn(TH, "text-right")}>Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {produtos.data.map((p, i) => (
                  <tr key={p.produtoId} className="transition-colors hover:bg-muted/30">
                    <td className={TD}>
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          i < 3 ? "bg-primary-soft text-primary-strong" : "text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className={cn(TD, "font-semibold text-foreground")}>{p.nome}</td>
                    <td className={cn(TD, "text-right text-muted-foreground tabular-nums")}>
                      {p.quantidade.toLocaleString("pt-BR")}
                    </td>
                    <td className={cn(TD, "text-right font-semibold tabular-nums")}>
                      {brl(p.faturamento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Carregando>
  );
}

// ---------------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------------

function AbaCaixa({ periodo }: { periodo: Periodo }) {
  const sessoes = useSessoesNoPeriodo(periodo);

  return (
    <Carregando consultas={[sessoes]}>
      {sessoes.data &&
        (sessoes.data.length === 0 ? (
          <Secao titulo="Sessões de caixa">
            <Vazio>Nenhum caixa aberto no período.</Vazio>
          </Secao>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <table className={cn(TABELA, "min-w-[52rem]")}>
              <thead className={CABECALHO}>
                <tr>
                  <th className={TH}>Caixa</th>
                  <th className={TH}>Abertura</th>
                  <th className={TH}>Fechamento</th>
                  <th className={cn(TH, "text-right")}>Fundo</th>
                  <th className={cn(TH, "text-right")}>Vendas</th>
                  <th className={cn(TH, "text-right")}>Suprimentos</th>
                  <th className={cn(TH, "text-right")}>Sangrias</th>
                  <th className={cn(TH, "text-right")}>Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessoes.data.map((s) => {
                  const vendas = s.totalDinheiro + s.totalPix + s.totalDebito + s.totalCredito;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-muted/30">
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">#{s.numero}</span>
                          {s.status === "OPEN" && <StatusBadge tone="primary">Aberto</StatusBadge>}
                        </div>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        {dateTime(s.abertaEm)}
                        <span className="block text-xs text-muted-foreground">
                          {s.nomeAbertura}
                        </span>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        {s.fechadaEm ? dateTime(s.fechadaEm) : "—"}
                        {s.nomeFechamento && (
                          <span className="block text-xs text-muted-foreground">
                            {s.nomeFechamento}
                          </span>
                        )}
                      </td>
                      <td className={cn(TD, "text-right text-muted-foreground tabular-nums")}>
                        {brl(s.valorInicial)}
                      </td>
                      <td className={cn(TD, "text-right font-semibold tabular-nums")}>
                        {brl(vendas)}
                      </td>
                      <td className={cn(TD, "text-right text-muted-foreground tabular-nums")}>
                        {brl(s.suprimentos)}
                      </td>
                      <td className={cn(TD, "text-right text-muted-foreground tabular-nums")}>
                        {brl(s.sangrias)}
                      </td>
                      <td
                        className={cn(
                          TD,
                          "text-right font-semibold tabular-nums",
                          s.diferenca !== null && s.diferenca !== 0 && "text-destructive",
                        )}
                        title={s.justificativa ?? undefined}
                      >
                        {s.diferenca === null ? "—" : brl(s.diferenca)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </Carregando>
  );
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

function AbaEstoque({ periodo }: { periodo: Periodo }) {
  const resumo = useResumoEstoque(periodo);
  const itens = useItensEstoque();

  return (
    <Carregando consultas={[resumo, itens]}>
      {resumo.data && itens.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Secao titulo="Movimentações no período">
            {resumo.data.length === 0 ? (
              <Vazio>Nenhuma movimentação no período.</Vazio>
            ) : (
              <ul className="-mx-5 divide-y divide-border border-t border-border text-sm">
                {resumo.data.map((r) => (
                  <li
                    key={`${r.tipo}-${r.origem}`}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="font-medium">
                      {r.origem === "PEDIDO"
                        ? r.tipo === "SAIDA"
                          ? "Baixas por venda"
                          : "Devoluções por cancelamento"
                        : TIPO_MOVIMENTACAO_ESTOQUE[r.tipo].label}
                    </span>
                    <span className="text-right text-xs text-muted-foreground tabular-nums">
                      {r.movimentacoes} {r.movimentacoes === 1 ? "lançamento" : "lançamentos"} ·{" "}
                      {r.itens} {r.itens === 1 ? "item" : "itens"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
          <Secao titulo="Abaixo do mínimo (agora)">
            {(() => {
              const alerta = itens.data.filter((i) => i.ativo && i.status !== "NORMAL");
              if (alerta.length === 0) {
                return (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleCheck className="size-4 text-success" aria-hidden="true" />
                    Nenhum item abaixo do mínimo.
                  </p>
                );
              }
              return (
                <ul className="-mx-5 divide-y divide-border border-t border-border text-sm">
                  {alerta.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0 truncate font-medium">{i.nome}</span>
                      <span className="text-right whitespace-nowrap tabular-nums">
                        <span
                          className={cn(
                            "font-bold",
                            i.status === "SEM_ESTOQUE"
                              ? "text-destructive"
                              : "text-warning-foreground",
                          )}
                        >
                          {formatarNumeroQuantidade(i.quantidade)}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {UNIDADE_LABEL[i.unidade]} · mín.{" "}
                          {formatarQuantidade(i.quantidadeMinima, i.unidade)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Secao>
        </div>
      )}
    </Carregando>
  );
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

const ACAO_LABEL: Record<string, string> = {
  "empresa.criada": "Empresa criada",
  "empresa.atualizada": "Dados da empresa alterados",
  "convite.criado": "Convite enviado",
  "convite.cancelado": "Convite cancelado",
  "convite.aceito": "Convite aceito",
  "membro.papel_alterado": "Papel de membro alterado",
  "membro.reativado": "Membro reativado",
  "membro.desativado": "Membro desativado",
  "produto.preco_alterado": "Preço alterado",
  "produto.disponibilidade_alterada": "Disponibilidade alterada",
  "produto.ficha_tecnica": "Ficha técnica alterada",
  "pedido.cancelado": "Pedido cancelado",
  "pedido.item_adicionado_apos_envio": "Item adicionado após envio",
  "pedido.item_alterado_apos_envio": "Item alterado após envio",
  "pedido.item_removido_apos_envio": "Item removido após envio",
  "pedido.valores_aplicados": "Desconto/acréscimo aplicado",
  "pedido.valores_alterados": "Desconto/acréscimo alterado",
  "comanda.transferida": "Comanda transferida",
  "comanda.cancelada": "Comanda cancelada",
  "caixa.aberto": "Caixa aberto",
  "caixa.fechado": "Caixa fechado",
  "caixa.sangria": "Sangria",
  "caixa.suprimento": "Suprimento",
  "pagamento.registrado": "Pagamento registrado",
  "pagamento.estornado": "Pagamento estornado",
  "estoque.item_criado": "Item de estoque criado",
  "estoque.ajuste": "Ajuste de estoque",
  "estoque.saida_manual": "Saída manual de estoque",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resumo legível dos dados auditados; sempre renderizado como texto. */
function resumirDados(dados: Json | null): string {
  if (dados === null || typeof dados !== "object" || Array.isArray(dados)) return "";
  return Object.entries(dados)
    .filter(
      ([, v]) => v !== null && typeof v !== "object" && !(typeof v === "string" && UUID.test(v)),
    )
    .map(([k, v]) => {
      const valor = typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
      return `${k.replaceAll("_", " ")}: ${valor}`;
    })
    .join(" · ");
}

function AbaAuditoria({ periodo }: { periodo: Periodo }) {
  const auditoria = useAuditoria(periodo);

  return (
    <Carregando consultas={[auditoria]}>
      {auditoria.data &&
        (auditoria.data.length === 0 ? (
          <Secao titulo="Auditoria">
            <Vazio>Nenhuma operação auditada no período.</Vazio>
          </Secao>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Operações críticas registradas pelo banco (até 200 mais recentes).
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm shadow-xs">
              {auditoria.data.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{ACAO_LABEL[r.acao] ?? r.acao}</p>
                    {resumirDados(r.dados) && (
                      <p className="text-xs break-words text-muted-foreground">
                        {resumirDados(r.dados)}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
                    {r.usuario}
                    <span className="block">{dateTime(r.criadoEm)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Carregando>
  );
}
