import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { iniciarConectividade } from "./lib/offline/conectividade";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Antes de qualquer consulta, para o TanStack Query já nascer sabendo se há conexão.
  iniciarConectividade();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000,
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
