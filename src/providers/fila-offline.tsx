import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { chaves } from "@/lib/chaves";
import { mensagemDeErro } from "@/lib/erros";
import { estadoConexao, useConexao } from "@/lib/offline/conectividade";
import {
  classificarFalha,
  deveSincronizar,
  estaPendente,
  listarFila,
  removerAcao,
  salvarAcao,
  type AcaoOffline,
} from "@/lib/offline/fila";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { criarPedido } from "@/services/pedidos";

type EstadoFila = {
  acoes: AcaoOffline[];
  /** Ações ainda não aceitas pelo servidor. */
  pendentes: number;
  /** Ações com erro ou conflito, que pedem atenção. */
  comProblema: number;
  sincronizando: boolean;
  sincronizar: () => void;
  recarregar: () => void;
  tentarDeNovo: (id: string) => void;
  descartar: (id: string) => void;
};

const FilaContext = createContext<EstadoFila | null>(null);

const INTERVALO_MS = 30_000;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Envia ao servidor, em ordem, as ações feitas sem conexão. Cada envio repete o
 * `client_request_id` original: se a resposta anterior se perdeu, o servidor
 * devolve o mesmo registro em vez de criar outro.
 */
export function FilaOfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { usuario, sessao } = useAuth();
  const { empresa } = useEmpresa();
  const conexao = useConexao();

  const usuarioId = usuario?.id ?? null;
  const empresaId = empresa?.id ?? null;
  // Sem sessão válida (ex.: token expirado offline) o servidor recusaria por
  // falta de autenticação, e isso viraria um falso conflito.
  const podeEnviar = sessao !== null && conexao === "ONLINE";

  const [acoes, setAcoes] = useState<AcaoOffline[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const rodando = useRef(false);

  const recarregar = useCallback(async () => {
    if (!usuarioId || !empresaId) {
      setAcoes([]);
      return;
    }
    setAcoes(await listarFila(usuarioId, empresaId));
  }, [usuarioId, empresaId]);

  const sincronizar = useCallback(async () => {
    if (!usuarioId || !empresaId || !podeEnviar || rodando.current) return;
    if (estadoConexao() === "OFFLINE") return;
    rodando.current = true;
    setSincronizando(true);

    const processar = async () => {
      const resultado = { aceitas: 0, recusadas: 0 };
      for (const acao of await listarFila(usuarioId, empresaId)) {
        if (!deveSincronizar(acao)) continue;

        await salvarAcao({ ...acao, estado: "sincronizando" });
        void recarregar();

        try {
          const id = await criarPedido(empresaId, { ...acao.entrada, requisicaoId: acao.id });
          await salvarAcao({ ...acao, estado: "sincronizado", resultadoId: id, erro: null });
          resultado.aceitas += 1;
        } catch (erro) {
          const tipo = classificarFalha(erro);
          if (tipo === "rede" || tipo === "sessao") {
            // Nada foi decidido: volta para a fila e tenta na próxima conexão.
            await salvarAcao({ ...acao, estado: "pendente" });
            break;
          }
          if (tipo === "regra") {
            await salvarAcao({ ...acao, estado: "conflito", erro: mensagemDeErro(erro) });
          } else {
            await salvarAcao({
              ...acao,
              estado: "erro",
              tentativas: acao.tentativas + 1,
              erro: mensagemDeErro(erro),
            });
          }
          resultado.recusadas += 1;
        }
      }
      return resultado;
    };

    try {
      // Duas abas abertas não processam a mesma fila ao mesmo tempo.
      const { aceitas, recusadas } =
        "locks" in navigator
          ? await navigator.locks.request(`arvon-fila:${usuarioId}:${empresaId}`, processar)
          : await processar();

      if (aceitas > 0) {
        for (const queryKey of [
          chaves.salao(empresaId),
          chaves.painelCozinha(empresaId),
          chaves.estoque(empresaId),
          chaves.dashboard(empresaId),
          chaves.clientes(empresaId),
        ]) {
          void queryClient.invalidateQueries({ queryKey });
        }
        toast.success(
          `${plural(aceitas, "pedido feito offline foi enviado", "pedidos feitos offline foram enviados")}.`,
        );
      }
      if (recusadas > 0) {
        toast.error(
          `${plural(recusadas, "pedido offline não foi aceito", "pedidos offline não foram aceitos")}. Veja em Pendências.`,
        );
      }
    } finally {
      rodando.current = false;
      setSincronizando(false);
      void recarregar();
    }
  }, [usuarioId, empresaId, podeEnviar, queryClient, recarregar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Reconectou (ou abriu o app online): envia o que ficou pendente.
  useEffect(() => {
    if (podeEnviar) void sincronizar();
  }, [podeEnviar, sincronizar]);

  const aSincronizar = acoes.some(deveSincronizar);
  useEffect(() => {
    if (!podeEnviar || !aSincronizar) return;
    const intervalo = setInterval(() => void sincronizar(), INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [podeEnviar, aSincronizar, sincronizar]);

  const tentarDeNovo = useCallback(
    async (id: string) => {
      const acao = acoes.find((a) => a.id === id);
      if (!acao) return;
      await salvarAcao({ ...acao, estado: "pendente", tentativas: 0, erro: null });
      await recarregar();
      void sincronizar();
    },
    [acoes, recarregar, sincronizar],
  );

  const descartar = useCallback(
    async (id: string) => {
      const acao = acoes.find((a) => a.id === id);
      if (!acao || acao.estado === "sincronizando") return;
      await removerAcao(acao);
      await recarregar();
    },
    [acoes, recarregar],
  );

  const valor = useMemo<EstadoFila>(
    () => ({
      acoes,
      pendentes: acoes.filter(estaPendente).length,
      comProblema: acoes.filter((a) => a.estado === "erro" || a.estado === "conflito").length,
      sincronizando,
      sincronizar: () => void sincronizar(),
      recarregar: () => void recarregar(),
      tentarDeNovo: (id) => void tentarDeNovo(id),
      descartar: (id) => void descartar(id),
    }),
    [acoes, sincronizando, sincronizar, recarregar, tentarDeNovo, descartar],
  );

  return <FilaContext value={valor}>{children}</FilaContext>;
}

export function useFilaOffline() {
  const contexto = useContext(FilaContext);
  if (!contexto) throw new Error("useFilaOffline deve ser usado dentro de FilaOfflineProvider");
  return contexto;
}
