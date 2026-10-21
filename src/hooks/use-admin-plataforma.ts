import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { useEmpresa } from "@/providers/empresa";
import * as servico from "@/services/admin-plataforma";

import { useMutacao } from "./use-mutacao";

export function useSouAdminPlataforma() {
  return useQuery({
    queryKey: chaves.adminPlataformaSou(),
    queryFn: () => servico.souAdminPlataforma(),
    staleTime: 60_000,
  });
}

export function useMetricasPlataforma(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.adminPlataformaMetricas(),
    queryFn: () => servico.buscarMetricasPlataforma(),
    enabled: habilitado,
  });
}

export function useEmpresasPlataforma(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.adminPlataformaEmpresas(),
    queryFn: () => servico.listarEmpresasPlataforma(),
    enabled: habilitado,
  });
}

export function useSuportesAbertos(habilitado: boolean) {
  return useQuery({
    queryKey: chaves.adminPlataformaSuportes(),
    queryFn: () => servico.listarSuportesAbertos(),
    enabled: habilitado,
  });
}

export function useAdminPlataformaMutations() {
  const { selecionarEmpresa, recarregar } = useEmpresa();

  const reclamar = useMutacao({
    executar: () => servico.reclamarAdminPlataforma(),
    sucesso: "Você é o administrador da plataforma.",
    invalidar: [chaves.adminPlataforma()],
  });

  const definirAtiva = useMutacao({
    executar: ({ empresaId, ativa }: { empresaId: string; ativa: boolean }) =>
      servico.definirEmpresaAtiva(empresaId, ativa),
    sucesso: (_saida, { ativa }) => (ativa ? "Empresa reativada." : "Empresa pausada."),
    invalidar: [chaves.adminPlataforma()],
  });

  const iniciarSuporte = useMutacao({
    executar: (empresaId: string) => servico.iniciarSuporte(empresaId),
    sucesso: "Acesso de suporte iniciado.",
    invalidar: [chaves.adminPlataforma(), ["vinculos"]],
    aoConcluir: (empresaId) => {
      selecionarEmpresa(empresaId);
      recarregar();
    },
  });

  const encerrarSuporte = useMutacao({
    executar: (empresaId: string) => servico.encerrarSuporte(empresaId),
    sucesso: "Acesso de suporte encerrado.",
    invalidar: [chaves.adminPlataforma(), ["vinculos"]],
    aoConcluir: () => recarregar(),
  });

  const criarEmpresa = useMutacao({
    executar: (entrada: servico.EntradaNovaEmpresa) => servico.criarEmpresaComLogin(entrada),
    sucesso: "Empresa e login criados. Envie as credenciais ao responsável.",
    invalidar: [chaves.adminPlataforma()],
  });

  return { reclamar, definirAtiva, iniciarSuporte, encerrarSuporte, criarEmpresa };
}
