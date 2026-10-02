import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { ERRO } from "@/lib/erros";
import { useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/clientes";

import { useMutacao } from "./use-mutacao";

export function useClientes() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.clientes(empresa.id),
    queryFn: () => servico.listarClientes(empresa.id),
  });
}

export function useHistoricoCliente(clienteId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.historicoCliente(empresa.id, clienteId ?? ""),
    queryFn: () => servico.buscarHistoricoCliente(empresa.id, clienteId ?? ""),
    enabled: !!clienteId,
  });
}

export function useClienteMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.clientes(empresa.id)];

  const salvar = useMutacao({
    executar: (entrada: servico.EntradaCliente) => servico.salvarCliente(empresa.id, entrada),
    sucesso: "Cliente salvo.",
    erros: { [ERRO.invalido]: "Confira o e-mail e o telefone informados." },
    invalidar,
  });

  const alternarAtivo = useMutacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      servico.definirClienteAtivo(id, ativo),
    invalidar,
  });

  return { salvar, alternarAtivo };
}
