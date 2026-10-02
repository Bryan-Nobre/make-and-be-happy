/*
 * Service worker do ARVON FOOD.
 *
 * Guarda só o "casco" do app (HTML das rotas e arquivos estáticos) para ele
 * abrir sem internet. Dados de negócio NUNCA passam por aqui: requisições ao
 * Supabase (REST, RPC, Auth, Realtime) e server functions seguem direto para a
 * rede. O cache de dados fica no IndexedDB, separado por usuário e empresa.
 *
 * O HTML do SSR não contém dado de usuário (a sessão vive no navegador), por
 * isso pode ser guardado sem escopo.
 */

const VERSAO = "v1";
const CACHE_PAGINAS = `arvon-paginas-${VERSAO}`;
const CACHE_ESTATICOS = `arvon-estaticos-${VERSAO}`;
const CACHE_EXTERNOS = `arvon-externos-${VERSAO}`;
const CACHES_ATUAIS = [CACHE_PAGINAS, CACHE_ESTATICOS, CACHE_EXTERNOS];

const LIMITE_ESTATICOS = 300;
const LIMITE_EXTERNOS = 150;
const TIMEOUT_NAVEGACAO_MS = 5000;

const FONTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith("arvon-") && !CACHES_ATUAIS.includes(nome))
          .map((nome) => caches.delete(nome)),
      );
      await self.clients.claim();
    })(),
  );
});

/** O HTML é guardado por caminho: `/pedidos?comanda=x` reaproveita o casco de `/pedidos`. */
const chaveDaPagina = (url) => new URL(url.pathname, url.origin).href;

async function aparar(nomeCache, limite) {
  const cache = await caches.open(nomeCache);
  const chaves = await cache.keys();
  if (chaves.length <= limite) return;
  await Promise.all(chaves.slice(0, chaves.length - limite).map((chave) => cache.delete(chave)));
}

function comTimeout(promessa, ms) {
  return new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error("timeout")), ms);
    promessa.then(
      (valor) => {
        clearTimeout(limite);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(limite);
        reject(erro);
      },
    );
  });
}

function ehHtml(resposta) {
  return (resposta.headers.get("content-type") || "").includes("text/html");
}

async function guardarPagina(url, resposta) {
  if (!resposta.ok || resposta.redirected || !ehHtml(resposta)) return;
  const cache = await caches.open(CACHE_PAGINAS);
  await cache.put(chaveDaPagina(url), resposta);
}

/** Rede primeiro; sem rede, o casco salvo da rota; sem casco, a página de fallback. */
async function navegar(request) {
  const url = new URL(request.url);
  try {
    const resposta = await comTimeout(fetch(request), TIMEOUT_NAVEGACAO_MS);
    void guardarPagina(url, resposta.clone());
    return resposta;
  } catch {
    const salva = await caches.match(chaveDaPagina(url), { cacheName: CACHE_PAGINAS });
    return salva || paginaOffline();
  }
}

async function cachePrimeiroLimitado(request, nomeCache, limite) {
  const salva = await caches.match(request, { cacheName: nomeCache });
  if (salva) return salva;
  const resposta = await fetch(request);
  if (resposta.ok || resposta.type === "opaque") {
    const cache = await caches.open(nomeCache);
    await cache.put(request, resposta.clone());
    void aparar(nomeCache, limite);
  }
  return resposta;
}

async function revalidarEmSegundoPlano(event, request, nomeCache, limite) {
  const salva = await caches.match(request, { cacheName: nomeCache });
  const rede = fetch(request)
    .then(async (resposta) => {
      if (resposta.ok || resposta.type === "opaque") {
        const cache = await caches.open(nomeCache);
        await cache.put(request, resposta.clone());
        void aparar(nomeCache, limite);
      }
      return resposta;
    })
    .catch(() => undefined);

  if (salva) {
    event.waitUntil(rede);
    return salva;
  }
  return (await rede) || Response.error();
}

function ehEstaticoDoApp(url) {
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:js|mjs|css|woff2?|ttf|png|jpe?g|svg|webp|ico|wasm|webmanifest)$/.test(url.pathname);
}

/** Imagens públicas do Storage (logos e fotos de produto). Nada privado passa por aqui. */
function ehImagemPublicaDoStorage(url) {
  return url.pathname.includes("/storage/v1/object/public/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    if (url.origin === self.location.origin) event.respondWith(navegar(request));
    return;
  }

  if (url.origin === self.location.origin) {
    // Server functions e qualquer rota de API nunca são cacheadas.
    if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;
    if (!ehEstaticoDoApp(url)) return;

    // Arquivos com hash no nome não mudam: cache primeiro. O resto revalida.
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cachePrimeiroLimitado(request, CACHE_ESTATICOS, LIMITE_ESTATICOS));
    } else {
      event.respondWith(revalidarEmSegundoPlano(event, request, CACHE_ESTATICOS, LIMITE_ESTATICOS));
    }
    return;
  }

  if (FONTES.includes(url.hostname)) {
    event.respondWith(revalidarEmSegundoPlano(event, request, CACHE_EXTERNOS, LIMITE_EXTERNOS));
    return;
  }

  if (ehImagemPublicaDoStorage(url)) {
    event.respondWith(cachePrimeiroLimitado(request, CACHE_EXTERNOS, LIMITE_EXTERNOS));
  }
});

/**
 * `aquecer`: guarda os arquivos carregados antes de o SW assumir a página e o
 * casco das rotas operacionais, para abrirem num reload offline.
 */
self.addEventListener("message", (event) => {
  const dados = event.data;
  if (!dados || typeof dados !== "object" || dados.tipo !== "aquecer") return;
  event.waitUntil(aquecer(dados.recursos || [], dados.paginas || []));
});

async function aquecer(recursos, paginas) {
  const estaticos = await caches.open(CACHE_ESTATICOS);
  await Promise.all(
    recursos.map(async (endereco) => {
      try {
        const url = new URL(endereco, self.location.origin);
        if (url.origin !== self.location.origin || !ehEstaticoDoApp(url)) return;
        if (await estaticos.match(url.href)) return;
        const resposta = await fetch(url.href);
        if (resposta.ok) await estaticos.put(url.href, resposta);
      } catch {
        // Melhor esforço: o recurso será guardado na próxima vez que for pedido.
      }
    }),
  );

  await Promise.all(
    paginas.map(async (caminho) => {
      try {
        const url = new URL(caminho, self.location.origin);
        if (url.origin !== self.location.origin) return;
        const resposta = await fetch(url.href, { credentials: "same-origin" });
        await guardarPagina(url, resposta);
      } catch {
        // Idem.
      }
    }),
  );
}

function paginaOffline() {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão — ARVON FOOD</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;background:#f7f7f5;color:#1c1c1c;padding:16px;box-sizing:border-box}
  main{max-width:420px;text-align:center}
  h1{font-size:20px;margin:0 0 8px}
  p{margin:0 0 20px;color:#666;font-size:14px;line-height:1.5}
  a,button{display:inline-block;margin:4px;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;cursor:pointer}
  button{background:#1c1c1c;color:#fff;border:0}
  a{border:1px solid #ddd;color:#1c1c1c;background:#fff}
</style>
</head>
<body>
<main>
  <h1>Você está sem conexão</h1>
  <p>Esta página ainda não foi aberta neste aparelho, por isso não está disponível offline. As telas que você já usou continuam acessíveis.</p>
  <button type="button" onclick="location.reload()">Tentar novamente</button>
  <a href="/pedidos">Pedidos</a>
  <a href="/mesas">Mesas</a>
  <a href="/cozinha">Cozinha</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
