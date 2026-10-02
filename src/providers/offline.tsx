import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { escopoDe, geracaoAtual, limparEscopo, limparOutrosUsuarios } from "@/lib/offline/banco";
import {
  lerMeta,
  podePersistir,
  restaurarConsultas,
  salvarConsultas,
} from "@/lib/offline/cache-consultas";
import { useConexao } from "@/lib/offline/conectividade";
import { podeVerModulo, type ModuloKey } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";

type EstadoCacheOffline = {
  /** O cache salvo do escopo atual já voltou para a memória (ou não havia nada). */
  restaurado: boolean;
  /** Momento do dado mais recente confirmado pelo servidor neste escopo. */
  ultimaSincronizacao: number | null;
};

const CacheOfflineContext = createContext<EstadoCacheOffline>({
  restaurado: true,
  ultimaSincronizacao: null,
});

const INTERVALO_SALVAMENTO_MS = 1000;
/** Se o IndexedDB travar, a tela não pode ficar presa esperando a restauração. */
const LIMITE_RESTAURACAO_MS = 2000;

const ROTAS_POR_MODULO = [
  ["dashboard", "/"],
  ["pdv", "/pedidos"],
  ["mesas", "/mesas"],
  ["cozinha", "/cozinha"],
  ["caixa", "/caixa"],
] as const satisfies readonly (readonly [ModuloKey, string])[];

/**
 * Espelha no IndexedDB as consultas operacionais do usuário na empresa atual,
 * para o app abrir offline com o último dado visto. Só leitura: mutations
 * continuam exigindo conexão.
 */
export function CacheOfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { usuario } = useAuth();
  const { empresa, papel } = useEmpresa();
  const conexao = useConexao();

  const usuarioId = usuario?.id ?? null;
  const empresaId = empresa?.id ?? null;
  const escopo = usuarioId && empresaId ? escopoDe(usuarioId, empresaId) : null;

  const [restauradoEm, setRestauradoEm] = useState<string | null>(null);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number | null>(null);
  const anterior = useRef<{ usuarioId: string; empresaId: string } | null>(null);

  useEffect(() => {
    if (usuarioId) void limparOutrosUsuarios(usuarioId);
  }, [usuarioId]);

  // Trocou de empresa (pelo menu ou porque o vínculo deixou de existir): apaga
  // o que era da anterior, no disco e na memória.
  useEffect(() => {
    const antes = anterior.current;
    if (antes && usuarioId === antes.usuarioId && empresaId !== antes.empresaId) {
      void limparEscopo(antes.usuarioId, antes.empresaId);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === antes.empresaId });
    }
    anterior.current = usuarioId && empresaId ? { usuarioId, empresaId } : null;
  }, [usuarioId, empresaId, queryClient]);

  useEffect(() => {
    if (!escopo || !empresaId || !papel) return;

    let ativo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let cancelarAssinatura: (() => void) | undefined;

    const concluir = () => {
      if (ativo) setRestauradoEm(escopo);
    };
    const limite = setTimeout(concluir, LIMITE_RESTAURACAO_MS);

    const salvar = () => {
      temporizador = undefined;
      if (!ativo) return;
      const geracao = geracaoAtual();
      void salvarConsultas(queryClient, escopo, empresaId, papel, geracao).then(() =>
        lerMeta(escopo).then((meta) => {
          if (ativo) setUltimaSincronizacao(meta?.ultimaSincronizacao ?? null);
        }),
      );
    };

    void (async () => {
      await restaurarConsultas(queryClient, escopo, empresaId, papel);
      const meta = await lerMeta(escopo);
      if (!ativo) return;
      setUltimaSincronizacao(meta?.ultimaSincronizacao ?? null);
      clearTimeout(limite);
      concluir();

      // Só começa a salvar depois de restaurar, para não sobrescrever o disco
      // com um cache ainda vazio.
      cancelarAssinatura = queryClient.getQueryCache().subscribe((evento) => {
        if (evento.type !== "updated" || evento.action.type !== "success") return;
        if (!podePersistir(evento.query.queryKey, empresaId, papel)) return;
        temporizador ??= setTimeout(salvar, INTERVALO_SALVAMENTO_MS);
      });
    })();

    return () => {
      ativo = false;
      clearTimeout(limite);
      clearTimeout(temporizador);
      cancelarAssinatura?.();
    };
  }, [escopo, empresaId, papel, queryClient]);

  // Baixa antecipadamente o código das telas operacionais do papel, para que
  // abram offline mesmo sem terem sido visitadas nesta sessão.
  useEffect(() => {
    if (!papel || conexao !== "ONLINE") return;
    for (const [modulo, rota] of ROTAS_POR_MODULO) {
      if (podeVerModulo(papel, modulo)) void router.preloadRoute({ to: rota }).catch(() => {});
    }
  }, [papel, conexao, router]);

  const restaurado = escopo === null || restauradoEm === escopo;

  return (
    <CacheOfflineContext value={{ restaurado, ultimaSincronizacao }}>
      {children}
    </CacheOfflineContext>
  );
}

export function useCacheOffline() {
  return useContext(CacheOfflineContext);
}
