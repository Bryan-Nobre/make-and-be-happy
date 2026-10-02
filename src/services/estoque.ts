import { exigirAlteracao } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/db";

type Enums = Database["public"]["Enums"];

export type UnidadeEstoque = Enums["unidade_estoque"];
export type TipoMovimentacaoEstoque = Enums["tipo_movimentacao_estoque"];
export type OrigemMovimentacaoEstoque = Enums["origem_movimentacao_estoque"];
export type StatusEstoque = Enums["status_estoque"];

export const UNIDADE_LABEL: Record<UnidadeEstoque, string> = {
  UN: "un",
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  CX: "cx",
  PCT: "pct",
};

export const UNIDADE_NOME: Record<UnidadeEstoque, string> = {
  UN: "Unidade",
  KG: "Quilo (kg)",
  G: "Grama (g)",
  L: "Litro (L)",
  ML: "Mililitro (ml)",
  CX: "Caixa",
  PCT: "Pacote",
};

export type ItemEstoque = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: UnidadeEstoque;
  quantidade: number;
  quantidadeMinima: number;
  ativo: boolean;
  status: StatusEstoque;
};

export type MovimentacaoEstoque = {
  id: string;
  itemNome: string;
  unidade: UnidadeEstoque;
  tipo: TipoMovimentacaoEstoque;
  origem: OrigemMovimentacaoEstoque;
  variacao: number;
  saldoResultante: number;
  motivo: string;
  observacao: string | null;
  nomeMembro: string | null;
  criadoEm: string;
};

export type InsumoFicha = { itemId: string; quantidade: number };

export type EntradaItemEstoque = {
  nome: string;
  codigo: string;
  categoria: string;
  unidade: UnidadeEstoque;
  quantidadeMinima: number;
};

export function formatarNumeroQuantidade(quantidade: number): string {
  return quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function formatarQuantidade(quantidade: number, unidade: UnidadeEstoque): string {
  return `${formatarNumeroQuantidade(quantidade)} ${UNIDADE_LABEL[unidade]}`;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listarItensEstoque(empresaId: string): Promise<ItemEstoque[]> {
  const { data, error } = await supabase
    .from("itens_estoque_status")
    .select("id, codigo, nome, categoria, unidade, quantidade, quantidade_minima, ativo, status")
    .eq("empresa_id", empresaId)
    .order("nome");

  if (error) throw error;

  return data.map((i) => ({
    id: i.id ?? "",
    codigo: i.codigo ?? "",
    nome: i.nome ?? "",
    categoria: i.categoria ?? "",
    unidade: i.unidade ?? "UN",
    quantidade: Number(i.quantidade ?? 0),
    quantidadeMinima: Number(i.quantidade_minima ?? 0),
    ativo: i.ativo ?? true,
    status: i.status ?? "NORMAL",
  }));
}

type LinhaMovimentacao = {
  id: string;
  tipo: TipoMovimentacaoEstoque;
  origem: OrigemMovimentacaoEstoque;
  variacao: number;
  saldo_resultante: number;
  motivo: string;
  observacao: string | null;
  nome_membro: string | null;
  criado_em: string;
  item: { nome: string; unidade: UnidadeEstoque } | null;
};

export async function listarMovimentacoesEstoque(
  empresaId: string,
  filtro: { itemId?: string; limite?: number } = {},
): Promise<MovimentacaoEstoque[]> {
  let consulta = supabase
    .from("movimentacoes_estoque")
    .select(
      `id, tipo, origem, variacao, saldo_resultante, motivo, observacao, nome_membro, criado_em,
       item:itens_estoque!movimentacoes_estoque_item_fk (nome, unidade)`,
    )
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .limit(filtro.limite ?? 100);

  if (filtro.itemId) consulta = consulta.eq("item_id", filtro.itemId);

  const { data, error } = await consulta.returns<LinhaMovimentacao[]>();
  if (error) throw error;

  return data.map((m) => ({
    id: m.id,
    itemNome: m.item?.nome ?? "",
    unidade: m.item?.unidade ?? "UN",
    tipo: m.tipo,
    origem: m.origem,
    variacao: Number(m.variacao),
    saldoResultante: Number(m.saldo_resultante),
    motivo: m.motivo,
    observacao: m.observacao,
    nomeMembro: m.nome_membro,
    criadoEm: m.criado_em,
  }));
}

export async function listarFichaTecnica(
  empresaId: string,
  produtoId: string,
): Promise<InsumoFicha[]> {
  const { data, error } = await supabase
    .from("produto_insumos")
    .select("item_id, quantidade")
    .eq("empresa_id", empresaId)
    .eq("produto_id", produtoId);

  if (error) throw error;
  return data.map((i) => ({ itemId: i.item_id, quantidade: Number(i.quantidade) }));
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

export async function criarItemEstoque(
  empresaId: string,
  entrada: EntradaItemEstoque & { saldoInicial: number; requisicaoId: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("criar_item_estoque", {
    p_empresa: empresaId,
    p_nome: entrada.nome.trim(),
    p_unidade: entrada.unidade,
    p_quantidade_minima: entrada.quantidadeMinima,
    p_codigo: entrada.codigo.trim() || undefined,
    p_categoria: entrada.categoria.trim() || undefined,
    p_saldo_inicial: entrada.saldoInicial,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
  return data;
}

/** Só dados cadastrais: o saldo não tem permissão de escrita direta. */
export async function atualizarItemEstoque(
  empresaId: string,
  id: string,
  entrada: EntradaItemEstoque,
): Promise<void> {
  await exigirAlteracao(
    supabase
      .from("itens_estoque")
      .update({
        nome: entrada.nome.trim(),
        codigo: entrada.codigo.trim() || null,
        categoria: entrada.categoria.trim() || null,
        unidade: entrada.unidade,
        quantidade_minima: entrada.quantidadeMinima,
      })
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .select("id"),
  );
}

export async function definirItemEstoqueAtivo(
  empresaId: string,
  id: string,
  ativo: boolean,
): Promise<void> {
  await exigirAlteracao(
    supabase
      .from("itens_estoque")
      .update({ ativo })
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .select("id"),
  );
}

/** Em AJUSTE, `quantidade` é o novo saldo contado; nos demais, o quanto entra ou sai. */
export async function movimentarEstoque(
  empresaId: string,
  entrada: {
    itemId: string;
    tipo: TipoMovimentacaoEstoque;
    quantidade: number;
    motivo: string;
    observacao: string;
    requisicaoId: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("movimentar_estoque", {
    p_empresa: empresaId,
    p_item: entrada.itemId,
    p_tipo: entrada.tipo,
    p_quantidade: entrada.quantidade,
    p_motivo: entrada.motivo.trim(),
    p_observacao: entrada.observacao.trim() || undefined,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
}

export async function definirFichaTecnica(
  produtoId: string,
  insumos: InsumoFicha[],
): Promise<void> {
  const payload: Json = insumos.map((i) => ({ item_id: i.itemId, quantidade: i.quantidade }));
  const { error } = await supabase.rpc("definir_ficha_tecnica", {
    p_produto: produtoId,
    p_insumos: payload,
  });

  if (error) throw error;
}
