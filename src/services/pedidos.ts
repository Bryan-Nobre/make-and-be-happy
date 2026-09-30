import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/db";

type Enums = Database["public"]["Enums"];

export type StatusPedido = Enums["status_operacional_pedido"];
export type StatusFinanceiro = Enums["status_financeiro_pedido"];
export type StatusComanda = Enums["status_comanda"];
export type StatusMesa = Enums["status_mesa"];
export type OrigemPedido = Enums["origem_pedido"];

export type MesaEstado = {
  id: string;
  nome: string;
  lugares: number;
  status: StatusMesa;
  comandaId: string | null;
  comandaNumero: number | null;
  pessoas: number | null;
  abertaEm: string | null;
  total: number;
  valorPago: number;
  pedidosEmProducao: number;
};

export type ComandaResumo = {
  id: string;
  numero: number;
  mesaId: string;
  nomeMesa: string;
  pessoas: number | null;
  status: StatusComanda;
  taxaServicoPercentual: number;
  subtotal: number;
  taxaServico: number;
  total: number;
  valorPago: number;
  pedidosEmProducao: number;
  abertaEm: string;
};

export type ItemDoPedido = {
  id: string;
  nomeProduto: string;
  quantidade: number;
  total: number;
  observacoes: string | null;
  adicionais: string[];
};

export type PedidoDaComanda = {
  id: string;
  numero: number;
  status: StatusPedido;
  statusFinanceiro: StatusFinanceiro;
  total: number;
  criadoEm: string;
  itens: ItemDoPedido[];
};

export type ItemCozinha = {
  id: string;
  nomeProduto: string;
  quantidade: number;
  observacoes: string | null;
  nomeSetor: string | null;
  adicionais: string[];
  /** Lançado depois que o pedido já tinha ido para a produção. */
  adicionadoDepois: boolean;
};

export type TicketCozinha = {
  pedidoId: string;
  numero: number;
  origem: OrigemPedido;
  status: StatusPedido;
  nomeMesa: string | null;
  comandaNumero: number | null;
  observacoes: string | null;
  /** Momento em que o pedido entrou na fila da cozinha. */
  enviadoEm: string;
  itens: ItemCozinha[];
};

/**
 * O que o navegador envia para montar um item. Preço, nome e setor são
 * resolvidos no banco a partir do cadastro vigente.
 */
export type ItemNovo = {
  produtoId: string;
  quantidade: number;
  observacoes: string;
  adicionais: string[];
};

const MARGEM_ITEM_POSTERIOR_MS = 5000;

// ---------------------------------------------------------------------------
// Salão
// ---------------------------------------------------------------------------

export async function listarMesasEstado(empresaId: string): Promise<MesaEstado[]> {
  const { data, error } = await supabase
    .from("mesas_estado")
    .select(
      "id, nome, lugares, status, comanda_id, comanda_numero, pessoas, aberta_em, total, valor_pago, pedidos_em_producao",
    )
    .eq("empresa_id", empresaId)
    .eq("ativa", true)
    .order("ordem")
    .order("nome");

  if (error) throw error;

  return data.map((m) => ({
    id: m.id ?? "",
    nome: m.nome ?? "",
    lugares: m.lugares ?? 0,
    status: m.status ?? "LIVRE",
    comandaId: m.comanda_id,
    comandaNumero: m.comanda_numero,
    pessoas: m.pessoas,
    abertaEm: m.aberta_em,
    total: Number(m.total ?? 0),
    valorPago: Number(m.valor_pago ?? 0),
    pedidosEmProducao: m.pedidos_em_producao ?? 0,
  }));
}

export async function buscarComanda(
  empresaId: string,
  comandaId: string,
): Promise<ComandaResumo | null> {
  const { data, error } = await supabase
    .from("comandas_resumo")
    .select(
      "id, numero, mesa_id, nome_mesa, pessoas, status, taxa_servico_percentual, subtotal, taxa_servico, total, valor_pago, pedidos_em_producao, aberta_em",
    )
    .eq("empresa_id", empresaId)
    .eq("id", comandaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id ?? comandaId,
    numero: data.numero ?? 0,
    mesaId: data.mesa_id ?? "",
    nomeMesa: data.nome_mesa ?? "",
    pessoas: data.pessoas,
    status: data.status ?? "OPEN",
    taxaServicoPercentual: Number(data.taxa_servico_percentual ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    taxaServico: Number(data.taxa_servico ?? 0),
    total: Number(data.total ?? 0),
    valorPago: Number(data.valor_pago ?? 0),
    pedidosEmProducao: data.pedidos_em_producao ?? 0,
    abertaEm: data.aberta_em ?? new Date().toISOString(),
  };
}

type LinhaPedido = {
  id: string;
  numero: number;
  status_operacional: StatusPedido;
  status_financeiro: StatusFinanceiro;
  total: number;
  criado_em: string;
  itens_pedido: {
    id: string;
    nome_produto: string;
    quantidade: number;
    total: number;
    observacoes: string | null;
    item_pedido_adicional: { nome_opcao: string }[];
  }[];
};

export async function listarPedidosDaComanda(
  empresaId: string,
  comandaId: string,
): Promise<PedidoDaComanda[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(
      `id, numero, status_operacional, status_financeiro, total, criado_em,
       itens_pedido (id, nome_produto, quantidade, total, observacoes, criado_em,
         item_pedido_adicional (nome_opcao))`,
    )
    .eq("empresa_id", empresaId)
    .eq("comanda_id", comandaId)
    .order("criado_em")
    .order("criado_em", { referencedTable: "itens_pedido" })
    .returns<LinhaPedido[]>();

  if (error) throw error;

  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    status: p.status_operacional,
    statusFinanceiro: p.status_financeiro,
    total: Number(p.total),
    criadoEm: p.criado_em,
    itens: p.itens_pedido.map((i) => ({
      id: i.id,
      nomeProduto: i.nome_produto,
      quantidade: Number(i.quantidade),
      total: Number(i.total),
      observacoes: i.observacoes,
      adicionais: i.item_pedido_adicional.map((a) => a.nome_opcao),
    })),
  }));
}

export async function abrirComanda(
  empresaId: string,
  entrada: { mesaId: string; pessoas: number; requisicaoId: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("abrir_comanda", {
    p_empresa: empresaId,
    p_mesa: entrada.mesaId,
    p_pessoas: entrada.pessoas,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
  return data;
}

export async function pedirConta(comandaId: string): Promise<void> {
  const { error } = await supabase.rpc("pedir_conta", { p_comanda: comandaId });
  if (error) throw error;
}

/** Volta a comanda para aberta; pagamentos já feitos continuam valendo. */
export async function reabrirComanda(comandaId: string): Promise<void> {
  const { error } = await supabase.rpc("reabrir_comanda", { p_comanda: comandaId });
  if (error) throw error;
}

export async function transferirComanda(comandaId: string, mesaDestinoId: string): Promise<void> {
  const { error } = await supabase.rpc("transferir_comanda", {
    p_comanda: comandaId,
    p_mesa_destino: mesaDestinoId,
  });
  if (error) throw error;
}

export async function encerrarComanda(comandaId: string): Promise<void> {
  const { error } = await supabase.rpc("encerrar_comanda", { p_comanda: comandaId });
  if (error) throw error;
}

export async function cancelarComanda(comandaId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_comanda", {
    p_comanda: comandaId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export async function criarPedido(
  empresaId: string,
  entrada: {
    comandaId: string | null;
    itens: ItemNovo[];
    desconto: number;
    requisicaoId: string;
  },
): Promise<string> {
  const itens: Json = entrada.itens.map((item) => ({
    produto_id: item.produtoId,
    quantidade: item.quantidade,
    observacoes: item.observacoes,
    adicionais: item.adicionais,
  }));

  const { data, error } = await supabase.rpc("criar_pedido", {
    p_empresa: empresaId,
    p_origem: entrada.comandaId ? "MESA" : "BALCAO",
    p_comanda: entrada.comandaId ?? undefined,
    p_itens: itens,
    p_confirmar: true,
    p_desconto: entrada.desconto,
    p_client_request_id: entrada.requisicaoId,
  });

  if (error) throw error;
  return data;
}

export async function avancarStatusPedido(pedidoId: string, para: StatusPedido): Promise<void> {
  const { error } = await supabase.rpc("avancar_status_pedido", {
    p_pedido: pedidoId,
    p_para: para,
  });
  if (error) throw error;
}

export async function confirmarPedido(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_pedido", { p_pedido: pedidoId });
  if (error) throw error;
}

export async function cancelarPedido(pedidoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_pedido", {
    p_pedido: pedidoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Cozinha
// ---------------------------------------------------------------------------

/**
 * Painel de produção. Vem de uma função do banco que não devolve nenhum
 * valor financeiro: a cozinha não tem leitura direta sobre pedidos.
 */
export async function listarPainelCozinha(
  empresaId: string,
  setorId?: string | null,
): Promise<TicketCozinha[]> {
  const { data, error } = await supabase.rpc("painel_cozinha", {
    p_empresa: empresaId,
    p_setor: setorId ?? undefined,
  });
  if (error) throw error;

  const tickets = new Map<string, TicketCozinha>();

  for (const linha of data) {
    const confirmadoEm = linha.confirmado_em as string | null;

    let ticket = tickets.get(linha.pedido_id);
    if (!ticket) {
      ticket = {
        pedidoId: linha.pedido_id,
        numero: linha.numero,
        origem: linha.origem,
        status: linha.status,
        nomeMesa: linha.nome_mesa as string | null,
        comandaNumero: linha.comanda_numero as number | null,
        observacoes: linha.observacoes_pedido as string | null,
        enviadoEm: confirmadoEm ?? linha.criado_em,
        itens: [],
      };
      tickets.set(linha.pedido_id, ticket);
    }

    const enviadoEm = linha.enviado_em as string | null;

    ticket.itens.push({
      id: linha.item_id,
      nomeProduto: linha.nome_produto,
      quantidade: Number(linha.quantidade),
      observacoes: linha.observacoes_item as string | null,
      nomeSetor: linha.nome_setor as string | null,
      adicionais: linha.adicionais,
      adicionadoDepois:
        !!enviadoEm &&
        !!confirmadoEm &&
        new Date(enviadoEm).getTime() - new Date(confirmadoEm).getTime() > MARGEM_ITEM_POSTERIOR_MS,
    });
  }

  return [...tickets.values()];
}
