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
  dependentesDe,
  deveSincronizar,
  estaPendente,
  ligarAComanda,
  listarFila,
  removerAcao,
  salvarAcao,
  type AcaoOffline,
} from "@/lib/offline/fila";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import {
  abrirComanda,
  buscarComanda,
  criarPedido,
  listarMesasEstado,
  pedirConta,
} from "@/services/pedidos";

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
  /** Descarta a ação; numa abertura de mesa, leva junto os pedidos dela. */
  descartar: (id: string) => void;
  /** Abertura recusada porque a mesa já estava aberta: lança os pedidos na comanda existente. */
  relancarNaComandaAberta: (aberturaId: string) => void;
};

const FilaContext = createContext<EstadoFila | null>(null);

const INTERVALO_MS = 30_000;
const MENSAGEM_MESA_JA_ABERTA =
  "A mesa foi aberta em outro aparelho. Decida em Pendências o que fazer com este pedido.";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * `pedir_conta` não é idempotente no servidor. Se a recusa vier porque a conta
 * já está pedida (ex.: a resposta do envio anterior se perdeu), o objetivo foi
 * atingido e a ação conta como aceita.
 */
async function enviarPedidoDeConta(empresaId: string, comandaId: string) {
  try {
    await pedirConta(comandaId);
  } catch (erro) {
    if (classificarFalha(erro) !== "regra") throw erro;
    const comanda = await buscarComanda(empresaId, comandaId).catch(() => null);
    if (comanda?.status !== "PAYMENT_PENDING" && comanda?.status !== "PAID") throw erro;
  }
}

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
      const fila = await listarFila(usuarioId, empresaId);
      // Versão mais recente de cada ação: pedidos são reescritos quando a
      // abertura da mesa deles é aceita ou recusada neste mesmo ciclo.
      const atual = new Map(fila.map((a) => [a.id, a]));
      const salvar = async (acao: AcaoOffline) => {
        atual.set(acao.id, acao);
        await salvarAcao(acao);
      };

      for (const { id } of fila) {
        let acao = atual.get(id);
        if (!acao || !deveSincronizar(acao)) continue;

        // Ação em mesa aberta offline: só sai depois que a abertura for aceita.
        if (acao.tipo !== "abrir_comanda" && acao.entrada.comandaLocal) {
          const abertura = atual.get(acao.entrada.comandaLocal);
          if (abertura?.estado === "sincronizado" && abertura.resultadoId) {
            acao = ligarAComanda(acao, abertura.resultadoId);
          } else {
            if (!abertura) {
              await salvar({
                ...acao,
                estado: "conflito",
                erro: "A abertura desta mesa foi descartada.",
              });
              resultado.recusadas += 1;
            } else if (abertura.estado === "conflito") {
              await salvar({ ...acao, estado: "conflito", erro: MENSAGEM_MESA_JA_ABERTA });
            }
            continue;
          }
        }

        await salvar({ ...acao, estado: "sincronizando" });
        void recarregar();

        try {
          if (acao.tipo === "abrir_comanda") {
            const comandaId = await abrirComanda(empresaId, {
              ...acao.entrada,
              requisicaoId: acao.id,
            });
            await salvar({ ...acao, estado: "sincronizado", resultadoId: comandaId, erro: null });
            for (const dependente of dependentesDe([...atual.values()], acao.id)) {
              await salvar(ligarAComanda(dependente, comandaId));
            }
          } else if (acao.tipo === "pedir_conta") {
            const comandaId = acao.entrada.comandaId;
            if (!comandaId) throw new Error("Pedido de conta sem comanda.");
            await enviarPedidoDeConta(empresaId, comandaId);
            await salvar({ ...acao, estado: "sincronizado", resultadoId: comandaId, erro: null });
          } else {
            const { comandaLocal: _, ...entrada } = acao.entrada;
            const pedidoId = await criarPedido(empresaId, { ...entrada, requisicaoId: acao.id });
            await salvar({ ...acao, estado: "sincronizado", resultadoId: pedidoId, erro: null });
          }
          resultado.aceitas += 1;
        } catch (erro) {
          const tipo = classificarFalha(erro);
          if (tipo === "rede" || tipo === "sessao") {
            // Nada foi decidido: volta para a fila e tenta na próxima conexão.
            await salvar({ ...acao, estado: "pendente" });
            break;
          }
          if (tipo === "regra") {
            await salvar({ ...acao, estado: "conflito", erro: mensagemDeErro(erro) });
            if (acao.tipo === "abrir_comanda") {
              for (const dependente of dependentesDe([...atual.values()], acao.id)) {
                await salvar({ ...dependente, estado: "conflito", erro: MENSAGEM_MESA_JA_ABERTA });
              }
            }
          } else {
            await salvar({
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
          chaves.caixa(empresaId),
          chaves.estoque(empresaId),
          chaves.dashboard(empresaId),
          chaves.clientes(empresaId),
        ]) {
          void queryClient.invalidateQueries({ queryKey });
        }
        toast.success(
          `${plural(aceitas, "ação feita offline foi enviada", "ações feitas offline foram enviadas")}.`,
        );
      }
      if (recusadas > 0) {
        toast.error(
          `${plural(recusadas, "ação offline não foi aceita", "ações offline não foram aceitas")}. Veja em Pendências.`,
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
      if (acao.tipo === "abrir_comanda") {
        for (const dependente of dependentesDe(acoes, acao.id)) {
          await salvarAcao({ ...dependente, estado: "pendente", tentativas: 0, erro: null });
        }
      }
      await recarregar();
      void sincronizar();
    },
    [acoes, recarregar, sincronizar],
  );

  const descartar = useCallback(
    async (id: string) => {
      const acao = acoes.find((a) => a.id === id);
      if (!acao || acao.estado === "sincronizando") return;
      if (acao.tipo === "abrir_comanda") {
        for (const dependente of dependentesDe(acoes, acao.id)) await removerAcao(dependente);
      }
      await removerAcao(acao);
      await recarregar();
    },
    [acoes, recarregar],
  );

  const relancarNaComandaAberta = useCallback(
    async (aberturaId: string) => {
      const abertura = acoes.find((a) => a.id === aberturaId);
      if (!abertura || abertura.tipo !== "abrir_comanda" || !empresaId) return;

      let mesas;
      try {
        // Busca o estado atual no servidor: o cache pode estar desatualizado.
        mesas = await queryClient.fetchQuery({
          queryKey: chaves.mesasEstado(empresaId),
          queryFn: () => listarMesasEstado(empresaId),
          staleTime: 0,
        });
      } catch {
        toast.error("Sem conexão para conferir a mesa. Tente quando a internet voltar.");
        return;
      }

      const mesa = mesas.find((m) => m.id === abertura.entrada.mesaId);
      if (!mesa?.comandaId) {
        toast.error(`A ${abertura.resumo.mesa} não tem comanda aberta agora.`, {
          description: "Use “Tentar de novo” para abrir a mesa ou descarte os pedidos.",
        });
        return;
      }

      for (const dependente of dependentesDe(acoes, aberturaId)) {
        await salvarAcao({
          ...ligarAComanda(dependente, mesa.comandaId),
          estado: "pendente",
          tentativas: 0,
          erro: null,
        });
      }
      await removerAcao(abertura);
      toast.success(`Os pedidos serão lançados na comanda já aberta da ${mesa.nome}.`);
      await recarregar();
      void sincronizar();
    },
    [acoes, empresaId, queryClient, recarregar, sincronizar],
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
      relancarNaComandaAberta: (id) => void relancarNaComandaAberta(id),
    }),
    [
      acoes,
      sincronizando,
      sincronizar,
      recarregar,
      tentarDeNovo,
      descartar,
      relancarNaComandaAberta,
    ],
  );

  return <FilaContext value={valor}>{children}</FilaContext>;
}

export function useFilaOffline() {
  const contexto = useContext(FilaContext);
  if (!contexto) throw new Error("useFilaOffline deve ser usado dentro de FilaOfflineProvider");
  return contexto;
}
