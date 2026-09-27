import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { ERRO } from "@/lib/erros";
import { useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/mesas";

import { useMutacao } from "./use-mutacao";

export function useMesas() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.mesas(empresa.id),
    queryFn: () => servico.listarMesas(empresa.id),
  });
}

export function useMesaMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.mesas(empresa.id)];

  const salvar = useMutacao({
    executar: (entrada: { id?: string; nome: string; lugares: number; ordem: number }) =>
      servico.salvarMesa(empresa.id, entrada),
    sucesso: "Mesa salva.",
    erros: { [ERRO.duplicado]: "Já existe uma mesa com esse nome." },
    invalidar,
  });

  const alternarAtiva = useMutacao({
    executar: ({ id, ativa }: { id: string; ativa: boolean }) =>
      servico.definirMesaAtiva(id, ativa),
    invalidar,
  });

  const excluir = useMutacao({
    executar: (id: string) => servico.excluirMesa(id),
    sucesso: "Mesa excluída.",
    erros: { [ERRO.emUso]: "Esta mesa já tem histórico. Desative em vez de excluir." },
    invalidar,
  });

  return { salvar, alternarAtiva, excluir };
}
