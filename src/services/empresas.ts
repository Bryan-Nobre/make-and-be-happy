import { supabase } from "@/lib/supabase";
import type { Papel } from "@/lib/permissoes";

export type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  horarioFuncionamento: string | null;
  logoUrl: string | null;
  taxaServico: number;
  envioAutomaticoCozinha: boolean;
};

export type Vinculo = {
  membroId: string;
  papel: Papel;
  nomeExibicao: string;
  empresa: Empresa;
};

const COLUNAS_EMPRESA =
  "id, nome, cnpj, telefone, endereco, horario_funcionamento, logo_url, taxa_servico, envio_automatico_cozinha";

type LinhaEmpresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  horario_funcionamento: string | null;
  logo_url: string | null;
  taxa_servico: number;
  envio_automatico_cozinha: boolean;
};

type LinhaVinculo = {
  id: string;
  papel: Papel;
  nome_exibicao: string;
  empresas: LinhaEmpresa;
};

export function paraEmpresa(linha: LinhaEmpresa): Empresa {
  return {
    id: linha.id,
    nome: linha.nome,
    cnpj: linha.cnpj,
    telefone: linha.telefone,
    endereco: linha.endereco,
    horarioFuncionamento: linha.horario_funcionamento,
    logoUrl: linha.logo_url,
    taxaServico: Number(linha.taxa_servico),
    envioAutomaticoCozinha: linha.envio_automatico_cozinha,
  };
}

/**
 * Empresas às quais o usuário pertence. A RLS já restringe o resultado; o
 * filtro por `usuario_id` existe para não trazer os demais membros da equipe.
 */
export async function listarVinculos(usuarioId: string): Promise<Vinculo[]> {
  const { data, error } = await supabase
    .from("membros_empresa")
    .select(`id, papel, nome_exibicao, empresas!inner(${COLUNAS_EMPRESA})`)
    .eq("usuario_id", usuarioId)
    .eq("ativo", true)
    .order("criado_em", { ascending: true })
    .returns<LinhaVinculo[]>();

  if (error) throw error;

  return (data ?? []).map((linha) => ({
    membroId: linha.id,
    papel: linha.papel,
    nomeExibicao: linha.nome_exibicao,
    empresa: paraEmpresa(linha.empresas),
  }));
}

export async function criarEmpresaComOwner(entrada: {
  nome: string;
  nomeResponsavel: string;
  telefone?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("criar_empresa_com_owner", {
    p_nome: entrada.nome,
    p_nome_responsavel: entrada.nomeResponsavel,
    p_telefone: entrada.telefone?.trim() || undefined,
  });

  if (error) throw error;

  return data;
}
