/**
 * Banco local (IndexedDB) do modo offline.
 *
 * É só um espelho de leitura do que o servidor já devolveu: nada aqui é fonte
 * da verdade nem autoriza operação alguma. Os registros são separados por
 * usuário e por empresa e apagados no logout e na troca de empresa.
 *
 * IndexedDB não é criptografado: nunca grave aqui token, senha ou dado que o
 * papel do usuário não possa ler no servidor.
 */

const NOME_BANCO = "arvon-offline";
/** Versão da estrutura do IndexedDB (object stores). */
const VERSAO_BANCO = 1;
/** Versão do formato dos dados gravados. Mudou o formato, incremente: o que for antigo é descartado. */
export const SCHEMA_VERSION = 1;

export type Store = "meta" | "contexto" | "consultas";
const STORES: readonly Store[] = ["meta", "contexto", "consultas"];

/** Metadados de um escopo usuário + empresa. */
export type MetaEscopo = {
  schemaVersion: number;
  ultimaSincronizacao: number | null;
};

export const escopoDe = (usuarioId: string, empresaId: string) => `${usuarioId}:${empresaId}`;

let conexao: Promise<IDBDatabase | null> | null = null;
/** Incrementa a cada limpeza para descartar gravações iniciadas antes dela. */
let geracao = 0;

export const geracaoAtual = () => geracao;

function disponivel() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase | null> {
  if (!disponivel()) return Promise.resolve(null);
  if (conexao) return conexao;

  conexao = new Promise((resolve) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      for (const store of STORES) {
        if (!banco.objectStoreNames.contains(store)) banco.createObjectStore(store);
      }
    };
    pedido.onsuccess = () => {
      const banco = pedido.result;
      // Outra aba atualizou a estrutura: fecha para não bloquear a migração dela.
      banco.onversionchange = () => {
        banco.close();
        conexao = null;
      };
      resolve(banco);
    };
    pedido.onerror = () => {
      conexao = null;
      resolve(null);
    };
    pedido.onblocked = () => resolve(null);
  });

  return conexao;
}

function concluir<T>(pedido: IDBRequest<T>, transacao: IDBTransaction): Promise<T | undefined> {
  return new Promise((resolve) => {
    transacao.oncomplete = () => resolve(pedido.result);
    transacao.onerror = () => resolve(undefined);
    transacao.onabort = () => resolve(undefined);
  });
}

export async function ler<T>(store: Store, chave: string): Promise<T | undefined> {
  const banco = await abrir();
  if (!banco) return undefined;
  try {
    const transacao = banco.transaction(store, "readonly");
    return (await concluir(transacao.objectStore(store).get(chave), transacao)) as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Grava um registro. Com `geracaoEsperada`, a gravação é ignorada se houve uma
 * limpeza depois que ela começou (ex.: logout no meio de um salvamento).
 */
export async function gravar(
  store: Store,
  chave: string,
  valor: unknown,
  geracaoEsperada?: number,
): Promise<void> {
  const banco = await abrir();
  if (!banco) return;
  if (geracaoEsperada !== undefined && geracaoEsperada !== geracao) return;
  try {
    const transacao = banco.transaction(store, "readwrite");
    await concluir(transacao.objectStore(store).put(valor, chave), transacao);
  } catch {
    // Persistência local é melhor esforço: falhar aqui não pode quebrar a tela.
  }
}

export async function remover(store: Store, chave: string): Promise<void> {
  const banco = await abrir();
  if (!banco) return;
  try {
    const transacao = banco.transaction(store, "readwrite");
    await concluir(transacao.objectStore(store).delete(chave), transacao);
  } catch {
    // Ver `gravar`.
  }
}

/** Apaga tudo o que pertence a uma empresa do usuário. */
export async function limparEscopo(usuarioId: string, empresaId: string): Promise<void> {
  geracao += 1;
  const escopo = escopoDe(usuarioId, empresaId);
  await Promise.all([remover("consultas", escopo), remover("meta", escopo)]);
}

/** Mantém só os registros do usuário informado (outro usuário pode ter saído sem logout). */
export async function limparOutrosUsuarios(usuarioId: string): Promise<void> {
  const banco = await abrir();
  if (!banco) return;
  try {
    const transacao = banco.transaction(STORES, "readwrite");
    for (const store of STORES) {
      const objectStore = transacao.objectStore(store);
      const pedido = objectStore.getAllKeys();
      pedido.onsuccess = () => {
        for (const chave of pedido.result) {
          const texto = String(chave);
          if (texto !== usuarioId && !texto.startsWith(`${usuarioId}:`)) {
            objectStore.delete(chave);
          }
        }
      };
    }
    await new Promise<void>((resolve) => {
      transacao.oncomplete = () => resolve();
      transacao.onerror = () => resolve();
      transacao.onabort = () => resolve();
    });
  } catch {
    // Ver `gravar`.
  }
}

/** Apaga todos os dados locais do modo offline. Usado no logout. */
export async function limparTudo(): Promise<void> {
  geracao += 1;
  const banco = await abrir();
  if (!banco) return;
  try {
    const transacao = banco.transaction(STORES, "readwrite");
    for (const store of STORES) transacao.objectStore(store).clear();
    await new Promise<void>((resolve) => {
      transacao.oncomplete = () => resolve();
      transacao.onerror = () => resolve();
      transacao.onabort = () => resolve();
    });
  } catch {
    // Ver `gravar`.
  }
}
