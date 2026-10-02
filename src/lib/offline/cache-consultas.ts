import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { podeVerModulo, type ModuloKey, type Papel } from "@/lib/permissoes";

import { gravar, ler, remover, SCHEMA_VERSION, type MetaEscopo } from "./banco";

type RegistroConsultas = {
  schemaVersion: number;
  salvoEm: number;
  estado: DehydratedState;
};

/** Cache mais velho que isso não é restaurado: dado antigo demais confunde mais do que ajuda. */
const IDADE_MAXIMA_MS = 24 * 60 * 60 * 1000;

const OPERACAO: readonly ModuloKey[] = ["pdv", "mesas"];

/**
 * Consultas que podem ir para o disco e o módulo exigido para cada uma. O que
 * não está aqui (relatórios, dashboard, estoque, clientes, equipe, histórico do
 * caixa) nunca é persistido.
 *
 * Nota: o filtro por papel só evita guardar no aparelho o que a tela daquele
 * papel não usa. O que cada papel pode ler é decidido pela RLS.
 */
const PERSISTIVEIS: Record<string, readonly ModuloKey[]> = {
  categorias: OPERACAO,
  produtos: OPERACAO,
  "grupos-adicionais": OPERACAO,
  mesas: OPERACAO,
  "formas-pagamento": OPERACAO,
  salao: OPERACAO,
  setores: [...OPERACAO, "cozinha"],
  cozinha: ["cozinha"],
};

/** No caixa, só o estado operacional: movimentações, pagamentos e fechamentos ficam de fora. */
const CAIXA_PERSISTIVEL = new Set(["sessao-aberta", "a-receber"]);

export function podePersistir(chave: QueryKey, empresaId: string, papel: Papel): boolean {
  const [prefixo, empresaDaChave, detalhe] = chave;
  if (typeof prefixo !== "string" || empresaDaChave !== empresaId) return false;

  if (prefixo === "caixa") {
    return (
      typeof detalhe === "string" && CAIXA_PERSISTIVEL.has(detalhe) && podeVerModulo(papel, "caixa")
    );
  }

  const modulos = PERSISTIVEIS[prefixo];
  return modulos !== undefined && modulos.some((modulo) => podeVerModulo(papel, modulo));
}

/**
 * Restaura o cache salvo do escopo. As consultas voltam marcadas como
 * invalidadas: a tela mostra o dado salvo, mas ele é rebuscado assim que houver
 * conexão e nunca é tratado como confirmado pelo servidor.
 */
export async function restaurarConsultas(
  queryClient: QueryClient,
  escopo: string,
  empresaId: string,
  papel: Papel,
): Promise<void> {
  const registro = await ler<RegistroConsultas>("consultas", escopo);
  if (!registro) return;

  if (
    registro.schemaVersion !== SCHEMA_VERSION ||
    Date.now() - registro.salvoEm > IDADE_MAXIMA_MS
  ) {
    await remover("consultas", escopo);
    return;
  }

  // O papel pode ter mudado desde o salvamento: refiltra antes de devolver à memória.
  const queries = registro.estado.queries.filter((q) =>
    podePersistir(q.queryKey, empresaId, papel),
  );
  if (queries.length === 0) return;

  hydrate(queryClient, { mutations: [], queries });

  const restauradas = new Set(queries.map((q) => q.queryHash));
  await queryClient.invalidateQueries({
    predicate: (q) => restauradas.has(q.queryHash),
    refetchType: "active",
  });
}

export async function salvarConsultas(
  queryClient: QueryClient,
  escopo: string,
  empresaId: string,
  papel: Papel,
  geracao: number,
): Promise<void> {
  const estado = dehydrate(queryClient, {
    shouldDehydrateQuery: (q) =>
      q.state.status === "success" && podePersistir(q.queryKey, empresaId, papel),
    shouldDehydrateMutation: () => false,
  });

  const registro: RegistroConsultas = {
    schemaVersion: SCHEMA_VERSION,
    salvoEm: Date.now(),
    estado,
  };
  const meta: MetaEscopo = {
    schemaVersion: SCHEMA_VERSION,
    ultimaSincronizacao: estado.queries.reduce<number | null>(
      (maior, q) => Math.max(maior ?? 0, q.state.dataUpdatedAt),
      null,
    ),
  };

  await gravar("consultas", escopo, registro, geracao);
  await gravar("meta", escopo, meta, geracao);
}

export async function lerMeta(escopo: string): Promise<MetaEscopo | null> {
  const meta = await ler<MetaEscopo>("meta", escopo);
  return meta && meta.schemaVersion === SCHEMA_VERSION ? meta : null;
}
