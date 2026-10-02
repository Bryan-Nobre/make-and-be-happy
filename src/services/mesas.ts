import { exigirAlteracao } from "@/lib/erros";
import { supabase } from "@/lib/supabase";

export type Mesa = {
  id: string;
  nome: string;
  lugares: number;
  ordem: number;
  ativa: boolean;
};

export async function listarMesas(empresaId: string): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, nome, lugares, ordem, ativa")
    .eq("empresa_id", empresaId)
    .order("ordem")
    .order("nome");

  if (error) throw error;
  return data;
}

export async function salvarMesa(
  empresaId: string,
  entrada: { id?: string; nome: string; lugares: number; ordem: number },
): Promise<void> {
  const valores = {
    nome: entrada.nome.trim(),
    lugares: entrada.lugares,
    ordem: entrada.ordem,
  };

  if (entrada.id) {
    await exigirAlteracao(supabase.from("mesas").update(valores).eq("id", entrada.id).select("id"));
    return;
  }

  const { error } = await supabase.from("mesas").insert({ empresa_id: empresaId, ...valores });
  if (error) throw error;
}

export async function definirMesaAtiva(id: string, ativa: boolean): Promise<void> {
  await exigirAlteracao(supabase.from("mesas").update({ ativa }).eq("id", id).select("id"));
}

/** Só funciona enquanto a mesa não tiver comanda no histórico (FK com RESTRICT). */
export async function excluirMesa(id: string): Promise<void> {
  await exigirAlteracao(supabase.from("mesas").delete().eq("id", id).select("id"));
}
