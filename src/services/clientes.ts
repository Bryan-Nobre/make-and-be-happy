import { supabase } from "@/lib/supabase";

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

export async function salvarCliente(empresaId: string, entrada: EntradaCliente): Promise<void> {
  const valores = {
    nome: entrada.nome.trim(),
    telefone: entrada.telefone.trim() || null,
    email: entrada.email.trim() || null,
    observacoes: entrada.observacoes.trim() || null,
  };

  const { error } = entrada.id
    ? await supabase.from("clientes").update(valores).eq("id", entrada.id)
    : await supabase.from("clientes").insert({ empresa_id: empresaId, ...valores });

  if (error) throw error;
}

/** Cliente não é excluído: preserva-se o vínculo com o histórico de pedidos. */
export async function definirClienteAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("clientes").update({ ativo }).eq("id", id);
  if (error) throw error;
}
