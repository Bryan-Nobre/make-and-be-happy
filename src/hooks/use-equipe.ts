import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import type { Papel } from "@/lib/permissoes";
import { useEmpresa, useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/equipe";

import { useMutacao } from "./use-mutacao";

export function useMembros() {
  const { empresa, papel } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.membros(empresa.id),
    queryFn: () => servico.listarMembros(empresa.id),
    enabled: papel === "owner" || papel === "admin",
  });
}

export function useConvitesPendentes() {
  const { empresa, papel } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.convites(empresa.id),
    queryFn: () => servico.listarConvitesPendentes(empresa.id),
    enabled: papel === "owner" || papel === "admin",
  });
}

export function useEquipeMutations() {
  const { empresa } = useEmpresaAtual();
  const { recarregar } = useEmpresa();
  const invalidar = [chaves.membros(empresa.id), chaves.convites(empresa.id)];

  const convidar = useMutacao({
    executar: (entrada: { email: string; nomeExibicao: string; papel: Papel }) =>
      servico.convidarMembro({ empresaId: empresa.id, ...entrada }),
    invalidar,
  });

  const cancelarConvite = useMutacao({
    executar: (conviteId: string) => servico.cancelarConvite(conviteId),
    sucesso: "Convite cancelado.",
    invalidar,
  });

  const alterarPapel = useMutacao({
    executar: ({ membroId, papel }: { membroId: string; papel: Papel }) =>
      servico.alterarPapelMembro(membroId, papel),
    sucesso: "Perfil atualizado.",
    invalidar,
    // O próprio usuário pode ter sido o alvo: o menu lateral precisa refletir.
    aoConcluir: recarregar,
  });

  const alternarAtivo = useMutacao({
    executar: ({ membroId, ativo }: { membroId: string; ativo: boolean }) =>
      servico.definirMembroAtivo(membroId, ativo),
    sucesso: (_, { ativo }) => (ativo ? "Acesso reativado." : "Acesso suspenso."),
    invalidar,
    aoConcluir: recarregar,
  });

  const renomear = useMutacao({
    executar: ({ membroId, nome }: { membroId: string; nome: string }) =>
      servico.renomearMembro(membroId, nome),
    sucesso: "Nome atualizado.",
    invalidar,
    aoConcluir: recarregar,
  });

  return { convidar, cancelarConvite, alterarPapel, alternarAtivo, renomear };
}
