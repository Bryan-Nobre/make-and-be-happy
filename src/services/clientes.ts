import { exigirAlteracao } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import type { OrigemPedido, StatusFinanceiro, StatusPedido } from "@/services/pedidos";

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
  ativo: boolean;
};

type LinhaCliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

function paraCliente(linha: LinhaCliente): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    telefone: linha.telefone ?? "",
    email: linha.email ?? "",
    observacoes: linha.observacoes ?? "",
    ativo: linha.ativo,
  };
}

export async function listarClientes(empresaId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, email, observacoes, ativo")
    .eq("empresa_id", empresaId)
    .order("nome");

  if (error) throw error;
  return (data ?? []).map(paraCliente);
}

export type EntradaCliente = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
};

/** Devolve o id do cliente salvo. */
export async function salvarCliente(empresaId: string, entrada: EntradaCliente): Promise<string> {
  const valores = {
    nome: entrada.nome.trim(),
    telefone: entrada.telefone.trim() || null,
    email: entrada.email.trim() || null,
    observacoes: entrada.observacoes.trim() || null,
  };

  if (entrada.id) {
    await exigirAlteracao(
      supabase.from("clientes").update(valores).eq("id", entrada.id).select("id"),
    );
    return entrada.id;
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ empresa_id: empresaId, ...valores })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type PedidoDoCliente = {
  id: string;
  numero: number;
  origem: OrigemPedido;
  status: StatusPedido;
  statusFinanceiro: StatusFinanceiro;
  total: number;
  criadoEm: string;
  nomeMesa: string | null;
};

export type HistoricoCliente = {
  pedidos: number;
  totalGasto: number;
  ultimoPedido: string | null;
  recentes: PedidoDoCliente[];
};

/**
 * Pedidos do cliente: os de balcão vinculados a ele e os das comandas dele.
 * Totais calculados no banco, sobre pedidos não cancelados.
 */
export async function buscarHistoricoCliente(
  empresaId: string,
  clienteId: string,
): Promise<HistoricoCliente> {
  const args = { p_empresa: empresaId, p_cliente: clienteId };
  const [historico, resumo] = await Promise.all([
    supabase.rpc("historico_cliente", args),
    supabase.rpc("resumo_cliente", args),
  ]);

  if (historico.error) throw historico.error;
  if (resumo.error) throw resumo.error;

  const linha = resumo.data[0];
  return {
    pedidos: Number(linha?.pedidos ?? 0),
    totalGasto: Number(linha?.total_gasto ?? 0),
    ultimoPedido: linha?.ultimo_pedido ?? null,
    recentes: historico.data.map((p) => ({
      id: p.id,
      numero: Number(p.numero),
      origem: p.origem,
      status: p.status_operacional,
      statusFinanceiro: p.status_financeiro,
      total: Number(p.total),
      criadoEm: p.criado_em,
      nomeMesa: p.nome_mesa,
    })),
  };
}

/** Cliente não é excluído: preserva-se o vínculo com o histórico de pedidos. */
export async function definirClienteAtivo(id: string, ativo: boolean): Promise<void> {
  await exigirAlteracao(supabase.from("clientes").update({ ativo }).eq("id", id).select("id"));
}
