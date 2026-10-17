import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/db";

type Enums = Database["public"]["Enums"];

/** Datas no formato `YYYY-MM-DD`, ambas inclusivas, no fuso da operação. */
export type Periodo = { inicio: string; fim: string };

export const FUSO_OPERACAO = "America/Sao_Paulo";

export function dataNoFuso(data: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_OPERACAO }).format(data);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Diferença, em ms, entre o relógio do fuso da operação e o UTC naquele instante. */
function deslocamentoDoFuso(instante: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_OPERACAO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(
    parte("year"),
    parte("month") - 1,
    parte("day"),
    parte("hour"),
    parte("minute"),
    parte("second"),
  );
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/** Instante da meia-noite de `data` (`YYYY-MM-DD`) no fuso da operação. */
function inicioDoDiaNoFuso(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const meiaNoiteUtc = Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1);
  // A segunda passada acerta dias em que o deslocamento muda (horário de verão).
  const estimativa = meiaNoiteUtc - deslocamentoDoFuso(meiaNoiteUtc);
  return new Date(meiaNoiteUtc - deslocamentoDoFuso(estimativa)).toISOString();
}

/** Limites do período como instantes, para filtrar colunas `timestamptz`. */
export function limitesDoPeriodo({ inicio, fim }: Periodo) {
  return {
    de: inicioDoDiaNoFuso(inicio),
    ate: inicioDoDiaNoFuso(somarDias(fim, 1)),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type ResumoDashboard = {
  faturamento: number;
  pedidos: number;
  ticketMedio: number;
  naFila: number;
  emPreparo: number;
  prontos: number;
  mesasOcupadas: number;
  mesasTotal: number;
  estoqueAlerta: number;
};

export async function buscarResumoDashboard(empresaId: string): Promise<ResumoDashboard> {
  const { data, error } = await supabase.rpc("resumo_dashboard", { p_empresa: empresaId });
  if (error) throw error;

  const r = data[0];
  return {
    faturamento: Number(r?.faturamento ?? 0),
    pedidos: r?.pedidos ?? 0,
    ticketMedio: Number(r?.ticket_medio ?? 0),
    naFila: r?.na_fila ?? 0,
    emPreparo: r?.em_preparo ?? 0,
    prontos: r?.prontos ?? 0,
    mesasOcupadas: r?.mesas_ocupadas ?? 0,
    mesasTotal: r?.mesas_total ?? 0,
    estoqueAlerta: r?.estoque_alerta ?? 0,
  };
}

export type PedidoRecente = {
  id: string;
  numero: number;
  origem: Enums["origem_pedido"];
  statusOperacional: Enums["status_operacional_pedido"];
  statusFinanceiro: Enums["status_financeiro_pedido"];
  total: number;
  criadoEm: string;
};

export async function listarPedidosDeHoje(empresaId: string): Promise<PedidoRecente[]> {
  const hoje = dataNoFuso();
  const { de } = limitesDoPeriodo({ inicio: hoje, fim: hoje });
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, origem, status_operacional, status_financeiro, subtotal, total, criado_em")
    .eq("empresa_id", empresaId)
    .neq("status_operacional", "DRAFT")
    .gte("criado_em", de)
    .order("criado_em", { ascending: false })
    .limit(8);

  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    origem: p.origem,
    statusOperacional: p.status_operacional,
    statusFinanceiro: p.status_financeiro,
    total: Number(p.total ?? p.subtotal),
    criadoEm: p.criado_em,
  }));
}

export type ItemEmAlerta = {
  id: string;
  nome: string;
  unidade: Enums["unidade_estoque"];
  quantidade: number;
  quantidadeMinima: number;
  status: Enums["status_estoque"];
};

export async function listarEstoqueEmAlerta(empresaId: string): Promise<ItemEmAlerta[]> {
  const { data, error } = await supabase
    .from("itens_estoque_status")
    .select("id, nome, unidade, quantidade, quantidade_minima, status")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .neq("status", "NORMAL")
    .order("quantidade")
    .limit(8);

  if (error) throw error;
  return data.map((i) => ({
    id: i.id ?? "",
    nome: i.nome ?? "",
    unidade: i.unidade ?? "UN",
    quantidade: Number(i.quantidade ?? 0),
    quantidadeMinima: Number(i.quantidade_minima ?? 0),
    status: i.status ?? "BAIXO",
  }));
}

// ---------------------------------------------------------------------------
// Relatórios (owner/admin; o banco recusa os demais papéis)
// ---------------------------------------------------------------------------

export type ResumoVendas = {
  pedidos: number;
  faturamento: number;
  descontos: number;
  ticketMedio: number;
  taxaServico: number;
  cancelados: number;
  valorCancelado: number;
};

export async function buscarResumoVendas(
  empresaId: string,
  periodo: Periodo,
): Promise<ResumoVendas> {
  const { data, error } = await supabase.rpc("relatorio_resumo", {
    p_empresa: empresaId,
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;

  const r = data[0];
  return {
    pedidos: r?.pedidos ?? 0,
    faturamento: Number(r?.faturamento ?? 0),
    descontos: Number(r?.descontos ?? 0),
    ticketMedio: Number(r?.ticket_medio ?? 0),
    taxaServico: Number(r?.taxa_servico ?? 0),
    cancelados: r?.cancelados ?? 0,
    valorCancelado: Number(r?.valor_cancelado ?? 0),
  };
}

export type VendaDiaria = { dia: string; pedidos: number; faturamento: number };

export async function listarVendasDiarias(
  empresaId: string,
  periodo: Periodo,
): Promise<VendaDiaria[]> {
  const { data, error } = await supabase.rpc("relatorio_vendas_diarias", {
    p_empresa: empresaId,
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return data.map((d) => ({ dia: d.dia, pedidos: d.pedidos, faturamento: Number(d.faturamento) }));
}

export type TotalForma = { metodo: Enums["metodo_pagamento"]; quantidade: number; valor: number };

export async function listarFormasPagamento(
  empresaId: string,
  periodo: Periodo,
): Promise<TotalForma[]> {
  const { data, error } = await supabase.rpc("relatorio_formas_pagamento", {
    p_empresa: empresaId,
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return data.map((f) => ({ metodo: f.metodo, quantidade: f.quantidade, valor: Number(f.valor) }));
}

export type ProdutoVendido = {
  produtoId: string;
  nome: string;
  quantidade: number;
  faturamento: number;
};

export async function listarProdutosVendidos(
  empresaId: string,
  periodo: Periodo,
): Promise<ProdutoVendido[]> {
  const { data, error } = await supabase.rpc("relatorio_produtos", {
    p_empresa: empresaId,
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
    p_limite: 50,
  });
  if (error) throw error;
  return data.map((p) => ({
    produtoId: p.produto_id,
    nome: p.nome,
    quantidade: Number(p.quantidade),
    faturamento: Number(p.faturamento),
  }));
}

export type ResumoEstoque = {
  tipo: Enums["tipo_movimentacao_estoque"];
  origem: Enums["origem_movimentacao_estoque"];
  movimentacoes: number;
  itens: number;
};

export async function listarResumoEstoque(
  empresaId: string,
  periodo: Periodo,
): Promise<ResumoEstoque[]> {
  const { data, error } = await supabase.rpc("relatorio_estoque", {
    p_empresa: empresaId,
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return data.map((e) => ({
    tipo: e.tipo,
    origem: e.origem,
    movimentacoes: e.movimentacoes,
    itens: e.itens,
  }));
}

export type PedidoCancelado = {
  id: string;
  numero: number;
  total: number;
  motivo: string | null;
  canceladoEm: string;
};

export async function listarCancelamentos(
  empresaId: string,
  periodo: Periodo,
): Promise<PedidoCancelado[]> {
  const { de, ate } = limitesDoPeriodo(periodo);
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, subtotal, total, motivo_cancelamento, cancelado_em")
    .eq("empresa_id", empresaId)
    .eq("status_operacional", "CANCELLED")
    .gte("cancelado_em", de)
    .lt("cancelado_em", ate)
    .order("cancelado_em", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    total: Number(p.total ?? p.subtotal),
    motivo: p.motivo_cancelamento,
    canceladoEm: p.cancelado_em ?? "",
  }));
}

export type CategoriaAuditoria =
  "pedidos" | "comandas" | "caixa" | "pagamentos" | "estoque" | "catalogo" | "equipe" | "empresa";

/** Prefixo do nome da ação (`pedido.cancelado` → `pedido`) de cada categoria. */
const PREFIXOS_CATEGORIA: Record<CategoriaAuditoria, string[]> = {
  pedidos: ["pedido"],
  comandas: ["comanda"],
  caixa: ["caixa"],
  pagamentos: ["pagamento"],
  estoque: ["estoque"],
  catalogo: ["produto"],
  equipe: ["membro", "convite"],
  empresa: ["empresa"],
};

export type FiltrosAuditoria = {
  periodo: Periodo;
  categoria: CategoriaAuditoria | null;
  usuarioId: string | null;
};

export type RegistroAuditoria = {
  id: number;
  acao: string;
  dados: Json | null;
  usuarioId: string | null;
  criadoEm: string;
};

export const TAMANHO_PAGINA_AUDITORIA = 50;

/**
 * Uma página da auditoria, da mais recente para a mais antiga. `antesDe` é o
 * id do último registro já carregado. Só dono e admin leem a tabela (RLS);
 * para os demais papéis o banco devolve a lista vazia.
 */
export async function listarAuditoria(
  empresaId: string,
  filtros: FiltrosAuditoria,
  antesDe: number | null,
): Promise<RegistroAuditoria[]> {
  const { de, ate } = limitesDoPeriodo(filtros.periodo);
  let consulta = supabase
    .from("auditoria")
    .select("id, acao, dados, usuario_id, criado_em")
    .eq("empresa_id", empresaId)
    .gte("criado_em", de)
    .lt("criado_em", ate);

  if (filtros.categoria) {
    const prefixos = PREFIXOS_CATEGORIA[filtros.categoria];
    consulta = consulta.or(prefixos.map((p) => `acao.like.${p}.*`).join(","));
  }
  if (filtros.usuarioId) consulta = consulta.eq("usuario_id", filtros.usuarioId);
  if (antesDe !== null) consulta = consulta.lt("id", antesDe);

  const { data, error } = await consulta
    .order("id", { ascending: false })
    .limit(TAMANHO_PAGINA_AUDITORIA);

  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    acao: r.acao,
    dados: r.dados,
    usuarioId: r.usuario_id,
    criadoEm: r.criado_em,
  }));
}

export type AutorAuditoria = { usuarioId: string; nome: string; ativo: boolean };

/** Membros da empresa, inclusive desativados, para nomear e filtrar os registros. */
export async function listarAutoresAuditoria(empresaId: string): Promise<AutorAuditoria[]> {
  const { data, error } = await supabase
    .from("membros_empresa")
    .select("usuario_id, nome_exibicao, ativo")
    .eq("empresa_id", empresaId)
    .order("nome_exibicao");

  if (error) throw error;
  return data.map((m) => ({ usuarioId: m.usuario_id, nome: m.nome_exibicao, ativo: m.ativo }));
}
