import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { mensagemDeErro } from "@/lib/erros";
import { estadoConexao } from "@/lib/offline/conectividade";

type Opcoes<TEntrada, TSaida> = {
  executar: (entrada: TEntrada) => Promise<TSaida>;
  /** Texto do toast de sucesso. Omita para não mostrar nenhum. */
  sucesso?: string | ((saida: TSaida, entrada: TEntrada) => string);
  /** Mensagens específicas desta operação, por código do Postgres. */
  erros?: Record<string, string>;
  /** Chaves invalidadas depois do sucesso. */
  invalidar?: readonly (readonly unknown[])[];
  aoConcluir?: (saida: TSaida, entrada: TEntrada) => void;
};

/**
 * Mutação com o comportamento padrão do app: invalida o cache no sucesso e
 * traduz o erro pelo contrato de `mensagemDeErro`.
 *
 * Não usa atualização otimista de propósito: o banco é a fonte da verdade e
 * várias regras só são conhecidas depois que ele responde.
 */
export function useMutacao<TEntrada = void, TSaida = void>({
  executar,
  sucesso,
  erros,
  invalidar = [],
  aoConcluir,
}: Opcoes<TEntrada, TSaida>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executar,
    onSuccess: async (saida, entrada) => {
      await Promise.all(invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

      if (sucesso) {
        toast.success(typeof sucesso === "function" ? sucesso(saida, entrada) : sucesso);
      }

      aoConcluir?.(saida, entrada);
    },
    onError: (causa) => {
      toast.error(
        estadoConexao() === "OFFLINE" || !navigator.onLine
          ? "Sem conexão. Esta ação precisa de internet e não foi realizada."
          : mensagemDeErro(causa, erros),
      );
    },
  });
}
