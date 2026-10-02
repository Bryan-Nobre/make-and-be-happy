import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

export type EstadoConexao = "ONLINE" | "OFFLINE" | "INSTAVEL";

/** Resposta acima disso conta como conexão instável. */
const LIMITE_LENTO_MS = 2500;
const TIMEOUT_MS = 6000;
const INTERVALO_ONLINE_MS = 30_000;
const INTERVALO_DEGRADADO_MS = 10_000;
/** Falhas seguidas do teste até considerar offline mesmo com `navigator.onLine`. */
const FALHAS_PARA_OFFLINE = 2;

let estado: EstadoConexao = "ONLINE";
let falhas = 0;
let verificando = false;
let iniciado = false;
let temporizador: ReturnType<typeof setTimeout> | undefined;
const ouvintes = new Set<() => void>();

function definir(novo: EstadoConexao) {
  if (novo === estado) return;
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function agendar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(
    () => void verificar(),
    estado === "ONLINE" ? INTERVALO_ONLINE_MS : INTERVALO_DEGRADADO_MS,
  );
}

/**
 * `navigator.onLine` só diz se há uma interface de rede; não garante que o
 * Supabase responde. Por isso o estado vem de um teste leve no endpoint de
 * saúde do Auth, que não lê dado nenhum.
 */
async function verificar() {
  if (verificando) return;

  if (!navigator.onLine) {
    falhas = FALHAS_PARA_OFFLINE;
    definir("OFFLINE");
    agendar();
    return;
  }

  // Aba em segundo plano não precisa de teste; volta a testar ao ficar visível.
  if (document.visibilityState === "hidden") {
    agendar();
    return;
  }

  verificando = true;
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TIMEOUT_MS);
  const inicio = performance.now();

  try {
    // Qualquer resposta HTTP prova que o servidor foi alcançado.
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      cache: "no-store",
      signal: controle.signal,
    });
    falhas = 0;
    definir(performance.now() - inicio > LIMITE_LENTO_MS ? "INSTAVEL" : "ONLINE");
  } catch {
    falhas += 1;
    definir(falhas >= FALHAS_PARA_OFFLINE ? "OFFLINE" : "INSTAVEL");
  } finally {
    clearTimeout(limite);
    verificando = false;
    agendar();
  }
}

/** Inicia o monitoramento uma única vez, só no navegador. */
export function iniciarConectividade() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;

  estado = navigator.onLine ? "ONLINE" : "OFFLINE";

  window.addEventListener("offline", () => {
    falhas = FALHAS_PARA_OFFLINE;
    definir("OFFLINE");
    agendar();
  });
  window.addEventListener("online", () => void verificar());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void verificar();
  });

  // Instável ainda conta como online para o TanStack Query: as consultas
  // tentam e, se falharem, o dado salvo continua na tela.
  onlineManager.setEventListener((setOnline) => {
    const sincronizar = () => setOnline(estado !== "OFFLINE");
    ouvintes.add(sincronizar);
    sincronizar();
    return () => {
      ouvintes.delete(sincronizar);
    };
  });

  void verificar();
}

export const estadoConexao = () => estado;

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useConexao(): EstadoConexao {
  return useSyncExternalStore(assinar, estadoConexao, () => "ONLINE");
}
