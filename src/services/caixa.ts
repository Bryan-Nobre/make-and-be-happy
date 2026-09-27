import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/db";

import type { MetodoPagamento } from "./configuracoes";

type Enums = Database["public"]["Enums"];

export type StatusSessaoCaixa = Enums["status_sessao_caixa"];
export type TipoMovimentacaoCaixa = Enums["tipo_movimentacao_caixa"];
export type StatusPagamento = Enums["status_pagamento"];

/**
 * Totais por forma já vêm líquidos de estornos. Com o caixa aberto são
 * calculados ao vivo pela view; depois do fechamento, são os gravados nele.
 */
export type SessaoCaixa = {
  id: string;
  numero: number;
  terminal: string;
  status: StatusSessaoCaixa;
  valorInicial: number;
  observacaoAbertura: string | null;
  nomeAbertura: string;
  abertaEm: string;
  nomeFechamento: string | null;
  fechadaEm: string | null;
  dinheiroEsperado: number;
  dinheiroInformado: number | null;
  diferenca: number | null;
  justificativa: string | null;
  totalDinheiro: number;
  totalPix: number;
  totalDebito: number;
  totalCredito: number;
  totalEstornos: number;
  suprimentos: number;
  sangrias: number;
  movimentacoes: number;
};

export type MovimentacaoCaixa = {
  id: string;
  tipo: TipoMovimentacaoCaixa;
  metodo: MetodoPagamento;
  valor: number;
  descricao: string | null;
  criadoEm: string;
};

export type PagamentoCaixa = {
  id: string;
  metodo: MetodoPagamento;
  valor: number;
  valorRecebido: number | null;
  troco: number | null;
  status: StatusPagamento;
  motivoEstorno: string | null;
  criadoEm: string;
  pedidoNumero: number | null;
  comandaNumero: number | null;
};

export type PedidoAReceber = {
  id: string;
  numero: number;
  total: number;
  valorPago: number;
  criadoEm: string;
};

export type PartePagamento = {
  metodo: MetodoPagamento;
  valor: number;
  /** Só para dinheiro: quanto o cliente entregou, para o banco calcular o troco. */
  valorRecebido?: number;
};

/** O pagamento vai para um pedido de balcão ou para a comanda da mesa, nunca os dois. */
export type AlvoPagamento = { pedidoId: string } | { comandaId: string };

export type ResultadoPagamento = { troco: number; saldo: number };

const COLUNAS_SESSAO =
  "id, numero, terminal, status, valor_inicial, observacao_abertura, nome_abertura, aberta_em, nome_fechamento, fechada_em, dinheiro_esperado, dinheiro_informado, diferenca, justificativa, total_dinheiro, total_pix, total_debito, total_credito, total_estornos, suprimentos, sangrias, movimentacoes";

type LinhaSessao = Omit<Database["public"]["Views"]["sessoes_caixa_resumo"]["Row"], "empresa_id">;

function paraSessao(s: LinhaSessao): SessaoCaixa {
  return {
    id: s.id ?? "",
    numero: s.numero ?? 0,
    terminal: s.terminal ?? "",
    status: s.status ?? "CLOSED",
    valorInicial: Number(s.valor_inicial ?? 0),
    observacaoAbertura: s.observacao_abertura,
    nomeAbertura: s.nome_abertura ?? "",
    abertaEm: s.aberta_em ?? "",
    nomeFechamento: s.nome_fechamento,
    fechadaEm: s.fechada_em,
    dinheiroEsperado: Number(s.dinheiro_esperado ?? 0),
    dinheiroInformado: s.dinheiro_informado === null ? null : Number(s.dinheiro_informado),
    diferenca: s.diferenca === null ? null : Number(s.diferenca),
    justificativa: s.justificativa,
    totalDinheiro: Number(s.total_dinheiro ?? 0),
    totalPix: Number(s.total_pix ?? 0),
    totalDebito: Number(s.total_debito ?? 0),
    totalCredito: Number(s.total_credito ?? 0),
    totalEstornos: Number(s.total_estornos ?? 0),
    suprimentos: Number(s.suprimentos ?? 0),
    sangrias: Number(s.sangrias ?? 0),
    movimentacoes: s.movimentacoes ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function buscarSessaoAberta(empresaId: string): Promise<SessaoCaixa | null> {
  const { data, error } = await supabase
    .from("sessoes_caixa_resumo")
    .select(COLUNAS_SESSAO)
    .eq("empresa_id", empresaId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error) throw error;
  return data ? paraSessao(data) : null;
}

export async function listarFechamentos(empresaId: string): Promise<SessaoCaixa[]> {
  const { data, error } = await supabase
    .from("sessoes_caixa_resumo")
    .select(COLUNAS_SESSAO)
    .eq("empresa_id", empresaId)
    .eq("status", "CLOSED")
    .order("fechada_em", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data.map(paraSessao);
}

/** Sessões abertas no intervalo `[de, ate)`, em instantes ISO. */
export async function listarSessoesNoPeriodo(
  empresaId: string,
  de: string,
  ate: string,
): Promise<SessaoCaixa[]> {
  const { data, error } = await supabase
    .from("sessoes_caixa_resumo")
    .select(COLUNAS_SESSAO)
    .eq("empresa_id", empresaId)
    .gte("aberta_em", de)
    .lt("aberta_em", ate)
    .order("aberta_em", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data.map(paraSessao);
}

export async function listarMovimentacoes(
  empresaId: string,
  sessaoId: string,
): Promise<MovimentacaoCaixa[]> {
  const { data, error } = await supabase
    .from("movimentacoes_caixa")
    .select("id, tipo, metodo, valor, descricao, criado_em")
    .eq("empresa_id", empresaId)
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: false });

  if (error) throw error;

  return data.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    metodo: m.metodo,
    valor: Number(m.valor),
    descricao: m.descricao,
    criadoEm: m.criado_em,
  }));
}

export async function listarPagamentos(
  empresaId: string,
  sessaoId: string,
): Promise<PagamentoCaixa[]> {
  const { data, error } = await supabase
    .from("pagamentos")
    .select(
      `id, metodo, valor, valor_recebido, troco, status, motivo_estorno, criado_em,
       pedido:pedidos!pagamentos_pedido_fk (numero),
       comanda:comandas!pagamentos_comanda_fk (numero)`,
    )
    .eq("empresa_id", empresaId)
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: false })
    .order("ordem");

  if (error) throw error;

  return data.map((p) => ({
    id: p.id,
    metodo: p.metodo,
    valor: Number(p.valor),
    valorRecebido: p.valor_recebido === null ? null : Number(p.valor_recebido),
    troco: p.troco === null ? null : Number(p.troco),
    status: p.status,
    motivoEstorno: p.motivo_estorno,
    criadoEm: p.criado_em,
    pedidoNumero: p.pedido?.numero ?? null,
    comandaNumero: p.comanda?.numero ?? null,
  }));
}

/** Pedidos de balcão ainda não quitados: são pagos direto no pedido. */
export async function listarPedidosAReceber(empresaId: string): Promise<PedidoAReceber[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, total, valor_pago, criado_em")
    .eq("empresa_id", empresaId)
    .eq("origem", "BALCAO")
    .in("status_financeiro", ["UNPAID", "PARTIALLY_PAID"])
    .neq("status_operacional", "CANCELLED")
    .neq("status_operacional", "DRAFT")
    .order("criado_em");

  if (error) throw error;

  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    total: Number(p.total),
    valorPago: Number(p.valor_pago),
    criadoEm: p.criado_em,
  }));
}

export async function buscarSaldoPedido(
  empresaId: string,
  pedidoId: string,
): Promise<{ numero: number; saldo: number }> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("numero, total, valor_pago")
    .eq("empresa_id", empresaId)
    .eq("id", pedidoId)
    .single();

  if (error) throw error;
  return { numero: data.numero, saldo: Number(data.total) - Number(data.valor_pago) };
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

export async function abrirCaixa(
  empresaId: string,
  entrada: { valorInicial: number; observacao: string; requisicaoId: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("abrir_caixa", {
    p_empresa: empresaId,
    p_valor_inicial: entrada.valorInicial,
    p_observacao: entrada.observacao.trim() || undefined,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
  return data;
}

export async function movimentarCaixa(
  empresaId: string,
  entrada: {
    tipo: Extract<TipoMovimentacaoCaixa, "SANGRIA" | "SUPRIMENTO">;
    valor: number;
    descricao: string;
    requisicaoId: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("movimentar_caixa", {
    p_empresa: empresaId,
    p_tipo: entrada.tipo,
    p_valor: entrada.valor,
    p_descricao: entrada.descricao.trim(),
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
}

export async function fecharCaixa(
  sessaoId: string,
  entrada: { dinheiroInformado: number; justificativa: string },
): Promise<void> {
  const { error } = await supabase.rpc("fechar_caixa", {
    p_sessao: sessaoId,
    p_dinheiro_informado: entrada.dinheiroInformado,
    p_justificativa: entrada.justificativa.trim() || undefined,
  });

  if (error) throw error;
}

/**
 * Registra todas as partes de uma vez. O banco recalcula o saldo devido,
 * valida as formas habilitadas e o troco, e devolve o resultado oficial.
 * Repetir a mesma `requisicaoId` devolve o resultado da primeira chamada.
 */
export async function registrarPagamento(
  empresaId: string,
  entrada: { alvo: AlvoPagamento; partes: PartePagamento[]; requisicaoId: string },
): Promise<ResultadoPagamento> {
  const partes: Json = entrada.partes.map((parte) => ({
    metodo: parte.metodo,
    valor: parte.valor,
    ...(parte.valorRecebido !== undefined ? { valor_recebido: parte.valorRecebido } : {}),
  }));

  const { data, error } = await supabase.rpc("registrar_pagamento", {
    p_empresa: empresaId,
    p_partes: partes,
    p_pedido: "pedidoId" in entrada.alvo ? entrada.alvo.pedidoId : undefined,
    p_comanda: "comandaId" in entrada.alvo ? entrada.alvo.comandaId : undefined,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;

  const linha = data[0];
  return { troco: Number(linha?.troco ?? 0), saldo: Number(linha?.saldo ?? 0) };
}

export async function estornarPagamento(pagamentoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("estornar_pagamento", {
    p_pagamento: pagamentoId,
    p_motivo: motivo.trim(),
  });

  if (error) throw error;
}
