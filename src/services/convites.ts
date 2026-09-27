import { supabase } from "@/lib/supabase";
import type { Papel } from "@/lib/permissoes";

export type ConviteResumo = {
  empresaNome: string;
  papel: Papel;
  email: string;
  nomeExibicao: string;
  valido: boolean;
};

/** O token é o segredo do convite: quem o possui pode ver a quem ele pertence. */
export async function consultarConvite(token: string): Promise<ConviteResumo | null> {
  const { data, error } = await supabase.rpc("consultar_convite", { p_token: token });

  if (error) throw error;

  const linha = data?.[0];
  if (!linha) return null;

  return {
    empresaNome: linha.empresa_nome,
    papel: linha.papel,
    email: linha.email,
    nomeExibicao: linha.nome_exibicao,
    valido: linha.valido,
  };
}

/** Retorna o id da empresa em que o usuário passou a ser membro. */
export async function aceitarConvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });

  if (error) throw error;

  return data;
}
