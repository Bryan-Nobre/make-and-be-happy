import { supabase } from "@/lib/supabase";

export type MetricasPlataforma = {
  empresas: number;
  empresasAtivas: number;
  empresasPausadas: number;
  membrosAtivos: number;
  caixasAbertos: number;
  vendasHoje: number;
};

export type EmpresaPlataforma = {
  id: string;
  nome: string;
  ativa: boolean;
  criadoEm: string;
  membros: number;
  caixasAbertos: number;
  vendasHoje: number;
};

export async function souAdminPlataforma(): Promise<boolean> {
  const { data, error } = await supabase.rpc("sou_admin_plataforma");
  if (error) throw error;
  return Boolean(data);
}

/** Só funciona uma vez, com a tabela de admins vazia. */
export async function reclamarAdminPlataforma(): Promise<void> {
  const { error } = await supabase.rpc("reclamar_admin_plataforma");
  if (error) throw error;
}

export async function buscarMetricasPlataforma(): Promise<MetricasPlataforma> {
  const { data, error } = await supabase.rpc("admin_plataforma_metricas");
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) {
    return {
      empresas: 0,
      empresasAtivas: 0,
      empresasPausadas: 0,
      membrosAtivos: 0,
      caixasAbertos: 0,
      vendasHoje: 0,
    };
  }
  return {
    empresas: Number(linha.empresas ?? 0),
    empresasAtivas: Number(linha.empresas_ativas ?? 0),
    empresasPausadas: Number(linha.empresas_pausadas ?? 0),
    membrosAtivos: Number(linha.membros_ativos ?? 0),
    caixasAbertos: Number(linha.caixas_abertos ?? 0),
    vendasHoje: Number(linha.vendas_hoje ?? 0),
  };
}

export async function listarEmpresasPlataforma(): Promise<EmpresaPlataforma[]> {
  const { data, error } = await supabase.rpc("admin_plataforma_listar_empresas");
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    nome: e.nome,
    ativa: e.ativa,
    criadoEm: e.criado_em,
    membros: Number(e.membros ?? 0),
    caixasAbertos: Number(e.caixas_abertos ?? 0),
    vendasHoje: Number(e.vendas_hoje ?? 0),
  }));
}

export async function definirEmpresaAtiva(empresaId: string, ativa: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_plataforma_definir_ativa", {
    p_empresa: empresaId,
    p_ativa: ativa,
  });
  if (error) throw error;
}

export async function iniciarSuporte(empresaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_plataforma_iniciar_suporte", {
    p_empresa: empresaId,
  });
  if (error) throw error;
  return data as string;
}

export async function encerrarSuporte(empresaId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_plataforma_encerrar_suporte", {
    p_empresa: empresaId,
  });
  if (error) throw error;
}

export type EntradaNovaEmpresa = {
  nome: string;
  nomeResponsavel: string;
  email: string;
  senha: string;
  telefone?: string;
};

export type EmpresaCriada = {
  empresaId: string;
  usuarioId: string;
  email: string;
};

/** Cria empresa + conta owner. Só admin da plataforma (RPC). */
export async function criarEmpresaComLogin(entrada: EntradaNovaEmpresa): Promise<EmpresaCriada> {
  const { data, error } = await supabase.rpc("admin_plataforma_criar_empresa", {
    p_nome: entrada.nome,
    p_nome_responsavel: entrada.nomeResponsavel,
    p_email: entrada.email,
    p_senha: entrada.senha,
    p_telefone: entrada.telefone?.trim() || undefined,
  });
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) throw new Error("Não foi possível criar a empresa.");
  return {
    empresaId: linha.empresa_id,
    usuarioId: linha.usuario_id,
    email: linha.email,
  };
}

/** Empresas em que o admin atual tem suporte aberto (RLS: só os próprios). */
export async function listarSuportesAbertos(): Promise<string[]> {
  const { data, error } = await supabase
    .from("acessos_suporte")
    .select("empresa_id")
    .is("encerrado_em", null);

  if (error) throw error;
  return (data ?? []).map((linha) => linha.empresa_id as string);
}
