/** Rotas cujo casco é guardado logo no primeiro acesso, para abrirem num reload offline. */
const ROTAS_OPERACIONAIS = ["/", "/pedidos", "/mesas", "/cozinha", "/caixa"];

function recursosCarregados(): string[] {
  const enderecos = new Set<string>();
  for (const entrada of performance.getEntriesByType("resource")) enderecos.add(entrada.name);
  document
    .querySelectorAll<HTMLScriptElement>("script[src]")
    .forEach((script) => enderecos.add(script.src));
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="modulepreload"]')
    .forEach((link) => enderecos.add(link.href));
  return [...enderecos].filter((endereco) => endereco.startsWith(location.origin));
}

/**
 * Registra o service worker em produção. Em desenvolvimento ele atrapalharia o
 * HMR do Vite, então qualquer registro antigo é removido.
 */
export async function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.map((registro) => registro.unregister()));
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const pronto = await navigator.serviceWorker.ready;
    pronto.active?.postMessage({
      tipo: "aquecer",
      recursos: recursosCarregados(),
      paginas: ROTAS_OPERACIONAIS,
    });
  } catch {
    // Sem service worker o app funciona normalmente, só não abre offline.
  }
}
