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

  const { error } = entrada.id
    ? await supabase.from("mesas").update(valores).eq("id", entrada.id)
    : await supabase.from("mesas").insert({ empresa_id: empresaId, ...valores });

  if (error) throw error;
}

export async function definirMesaAtiva(id: string, ativa: boolean): Promise<void> {
  const { error } = await supabase.from("mesas").update({ ativa }).eq("id", id);
  if (error) throw error;
}

/** Só funciona enquanto a mesa não tiver comanda no histórico (FK com RESTRICT). */
export async function excluirMesa(id: string): Promise<void> {
  const { error } = await supabase.from("mesas").delete().eq("id", id);
  if (error) throw error;
}
