import { supabase } from "@/lib/supabase";
import type { Papel } from "@/lib/permissoes";

export type Membro = {
  id: string;
  nomeExibicao: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  souEu: boolean;
};

export type Convite = {
  id: string;
  email: string;
  nomeExibicao: string;
  papel: Papel;
  expiraEm: string;
};

export async function listarMembros(empresaId: string): Promise<Membro[]> {
  const { data, error } = await supabase.rpc("listar_membros", { p_empresa: empresaId });

  if (error) throw error;

  return (data ?? []).map((linha) => ({
    id: linha.id,
    nomeExibicao: linha.nome_exibicao,
    email: linha.email ?? "",
    papel: linha.papel,
    ativo: linha.ativo,
    souEu: linha.sou_eu,
  }));
}

export async function listarConvitesPendentes(empresaId: string): Promise<Convite[]> {
  const { data, error } = await supabase
    .from("convites")
    .select("id, email, nome_exibicao, papel, expira_em")
    .eq("empresa_id", empresaId)
    .eq("status", "PENDENTE")
    .gt("expira_em", new Date().toISOString())
    .order("criado_em", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((linha) => ({
    id: linha.id,
    email: linha.email,
    nomeExibicao: linha.nome_exibicao,
    papel: linha.papel,
    expiraEm: linha.expira_em,
  }));
}

/** Devolve o token do convite, que compõe o link enviado à pessoa. */
export async function convidarMembro(entrada: {
  empresaId: string;
  email: string;
  nomeExibicao: string;
  papel: Papel;
}): Promise<string> {
  const { data, error } = await supabase.rpc("convidar_membro", {
    p_empresa: entrada.empresaId,
    p_email: entrada.email,
    p_nome_exibicao: entrada.nomeExibicao,
    p_papel: entrada.papel,
  });

  if (error) throw error;
  return data;
}

export async function cancelarConvite(conviteId: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_convite", { p_convite: conviteId });
  if (error) throw error;
}

export async function alterarPapelMembro(membroId: string, papel: Papel): Promise<void> {
  const { error } = await supabase.rpc("alterar_papel_membro", {
    p_membro: membroId,
    p_papel: papel,
  });

  if (error) throw error;
}

export async function definirMembroAtivo(membroId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.rpc("definir_membro_ativo", {
    p_membro: membroId,
    p_ativo: ativo,
  });

  if (error) throw error;
}

export async function renomearMembro(membroId: string, nomeExibicao: string): Promise<void> {
  const { error } = await supabase.rpc("renomear_membro", {
    p_membro: membroId,
    p_nome_exibicao: nomeExibicao,
  });

  if (error) throw error;
}

export function linkDoConvite(token: string): string {
  return `${window.location.origin}/aceitar-convite?token=${token}`;
}
