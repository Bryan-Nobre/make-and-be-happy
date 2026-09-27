import { createFileRoute } from "@tanstack/react-router";
import { Ban, DollarSign, Percent, Receipt, ShoppingBag } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatarQuantidade } from "@/services/estoque";
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex gap-1" role="group" aria-label="Atalhos de período">
          {ATALHOS.map((a) => {
            const p = { inicio: somarDias(hoje, -a.dias), fim: hoje };
            const ativo = p.inicio === periodo.inicio && p.fim === periodo.fim;
            return (
              <Button
                key={a.id}
                size="sm"
                variant={ativo ? "default" : "outline"}
                aria-pressed={ativo}
                onClick={() => aplicar(p)}
              >
                {a.label}
              </Button>
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
            <Label htmlFor="periodo-inicio" className="text-xs">
              De
            </Label>
            <Input
              id="periodo-inicio"
              type="date"
              className="h-9"
              max={hoje}
              value={rascunho.inicio}
              onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="periodo-fim" className="text-xs">
              Até
            </Label>
            <Input
              id="periodo-fim"
              type="date"
              className="h-9"
              max={hoje}
              value={rascunho.fim}
              onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value })}
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={!rascunhoValido}>
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="caixa">Caixa</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="vendas">
          <AbaVendas periodo={periodo} />
        </TabsContent>
        <TabsContent value="produtos">
          <AbaProdutos periodo={periodo} />
        </TabsContent>
        <TabsContent value="caixa">
          <AbaCaixa periodo={periodo} />
        </TabsContent>
        <TabsContent value="estoque">
          <AbaEstoque periodo={periodo} />
        </TabsContent>
        <TabsContent value="auditoria">
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
  if (consultas.some((c) => c.isPending)) return <LoadingState label="Carregando relatório…" />;
  return <>{children}</>;
}

function Secao({
  titulo,
  className,
  children,
}: {
  titulo: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      <h2 className="font-semibold">{titulo}</h2>
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
        <span className="truncate">{rotulo}</span>
        <span className="tabular-nums">{texto}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${maximo > 0 ? (Math.max(valor, 0) / maximo) * 100 : 0}%` }}
        />
      </div>
    </li>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Faturamento"
              value={brl(resumo.data.faturamento)}
              hint={
                resumo.data.descontos > 0
                  ? `Descontos concedidos: ${brl(resumo.data.descontos)}`
                  : undefined
              }
              icon={DollarSign}
            />
            <KpiCard label="Pedidos" value={String(resumo.data.pedidos)} icon={ShoppingBag} />
            <KpiCard label="Ticket médio" value={brl(resumo.data.ticketMedio)} icon={Receipt} />
            <KpiCard
              label="Taxa de serviço"
              value={brl(resumo.data.taxaServico)}
              hint="Fora do faturamento"
              icon={Percent}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Secao titulo="Vendas por dia" className="lg:col-span-2">
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

          <Secao titulo="Cancelamentos">
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Ban className="size-4" aria-hidden="true" />
              {resumo.data.cancelados} {resumo.data.cancelados === 1 ? "pedido" : "pedidos"} ·{" "}
              {brl(resumo.data.valorCancelado)}
            </p>
            {cancelamentos.data.length === 0 ? (
              <Vazio>Nenhum pedido cancelado no período.</Vazio>
            ) : (
              <ul className="divide-y text-sm">
                {cancelamentos.data.map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">#{c.numero}</span> ·{" "}
                      {c.motivo ?? "Sem motivo registrado"}
                    </span>
                    <span className="text-muted-foreground">
                      {dateTime(c.canceladoEm)} ·{" "}
                      <span className="tabular-nums">{brl(c.total)}</span>
                    </span>
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
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3 text-right">Quantidade</th>
                  <th className="p-3 text-right">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {produtos.data.map((p, i) => (
                  <tr key={p.produtoId}>
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">{p.nome}</td>
                    <td className="p-3 text-right tabular-nums">
                      {p.quantidade.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right tabular-nums">{brl(p.faturamento)}</td>
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
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Caixa</th>
                  <th className="p-3">Abertura</th>
                  <th className="p-3">Fechamento</th>
                  <th className="p-3 text-right">Fundo</th>
                  <th className="p-3 text-right">Vendas</th>
                  <th className="p-3 text-right">Suprimentos</th>
                  <th className="p-3 text-right">Sangrias</th>
                  <th className="p-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessoes.data.map((s) => {
                  const vendas = s.totalDinheiro + s.totalPix + s.totalDebito + s.totalCredito;
                  return (
                    <tr key={s.id}>
                      <td className="p-3 font-medium">
                        #{s.numero}
                        {s.status === "OPEN" && (
                          <span className="ml-2 text-xs text-success">aberto</span>
                        )}
                      </td>
                      <td className="p-3">
                        {dateTime(s.abertaEm)}
                        <span className="block text-xs text-muted-foreground">
                          {s.nomeAbertura}
                        </span>
                      </td>
                      <td className="p-3">
                        {s.fechadaEm ? dateTime(s.fechadaEm) : "—"}
                        {s.nomeFechamento && (
                          <span className="block text-xs text-muted-foreground">
                            {s.nomeFechamento}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{brl(s.valorInicial)}</td>
                      <td className="p-3 text-right tabular-nums">{brl(vendas)}</td>
                      <td className="p-3 text-right tabular-nums">{brl(s.suprimentos)}</td>
                      <td className="p-3 text-right tabular-nums">{brl(s.sangrias)}</td>
                      <td
                        className={cn(
                          "p-3 text-right tabular-nums",
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Secao titulo="Movimentações no período">
            {resumo.data.length === 0 ? (
              <Vazio>Nenhuma movimentação no período.</Vazio>
            ) : (
              <ul className="divide-y text-sm">
                {resumo.data.map((r) => (
                  <li key={`${r.tipo}-${r.origem}`} className="flex justify-between gap-2 py-2">
                    <span>
                      {r.origem === "PEDIDO"
                        ? r.tipo === "SAIDA"
                          ? "Baixas por venda"
                          : "Devoluções por cancelamento"
                        : TIPO_MOVIMENTACAO_ESTOQUE[r.tipo].label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
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
              if (alerta.length === 0) return <Vazio>Nenhum item abaixo do mínimo.</Vazio>;
              return (
                <ul className="divide-y text-sm">
                  {alerta.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2 py-2">
                      <span>{i.nome}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatarQuantidade(i.quantidade, i.unidade)} / mín.{" "}
                        {formatarQuantidade(i.quantidadeMinima, i.unidade)}
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
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {auditoria.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
                  <span className="font-medium">{ACAO_LABEL[r.acao] ?? r.acao}</span>
                  <span className="min-w-0 flex-1 break-words text-muted-foreground">
                    {resumirDados(r.dados)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.usuario} · {dateTime(r.criadoEm)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Carregando>
  );
}
