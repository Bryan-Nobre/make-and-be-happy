import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { iniciarConectividade, verificarConexao } from "./lib/offline/conectividade";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Antes de qualquer consulta, para o TanStack Query já nascer sabendo se há conexão.
  iniciarConectividade();

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: verificarConexao }),
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000,
        // O cache offline salva uma foto do que está na memória. Com o padrão
        // de 5 min, telas não abertas sumiam da memória e, no salvamento
        // seguinte, também do disco. 24h acompanha a validade do cache salvo.
        gcTime: 24 * 60 * 60 * 1000,
      },
      mutations: {
        // Sem conexão a mutation falha na hora em vez de ficar pausada e ser
        // reenviada sozinha ao reconectar: não existe fila offline.
        networkMode: "always",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
