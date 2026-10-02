import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { useEmpresa, useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/configuracoes";

import { useMutacao } from "./use-mutacao";

export function useFormasPagamento() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.formasPagamento(empresa.id),
    queryFn: () => servico.listarFormasPagamento(empresa.id),
  });
}

export function useEmpresaMutations() {
  const { empresa } = useEmpresaAtual();
  const { recarregar } = useEmpresa();

  const salvar = useMutacao({
    executar: (entrada: servico.EntradaEmpresa) => servico.atualizarEmpresa(empresa.id, entrada),
    sucesso: "Configurações salvas.",
    // O nome e a taxa aparecem no cabeçalho e nos totais: recarrega o vínculo.
    aoConcluir: recarregar,
  });

  const enviarLogo = useMutacao({
    executar: (arquivo: File) => servico.enviarLogo(empresa.id, arquivo, empresa.logoUrl),
    sucesso: "Logo atualizado.",
    aoConcluir: recarregar,
  });

  const removerLogo = useMutacao({
    executar: () => servico.removerLogo(empresa.id, empresa.logoUrl),
    sucesso: "Logo removido.",
    aoConcluir: recarregar,
  });

  const alternarFormaPagamento = useMutacao({
    executar: ({ metodo, ativa }: { metodo: servico.MetodoPagamento; ativa: boolean }) =>
      servico.definirFormaPagamentoAtiva(empresa.id, metodo, ativa),
    invalidar: [chaves.formasPagamento(empresa.id)],
  });

  return { salvar, enviarLogo, removerLogo, alternarFormaPagamento };
}
