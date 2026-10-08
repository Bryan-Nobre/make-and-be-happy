import type { ItemNovo } from "@/services/pedidos";

import { gravar, listarPorPrefixo, remover, SCHEMA_VERSION } from "./banco";
import { estadoConexao } from "./conectividade";

/**
 * Fila de ações feitas sem conexão.
 *
 * Uma ação na fila NÃO aconteceu: é só um pedido guardado no aparelho. Ela só
 * vale depois que o servidor aceita, revalidando tudo (permissão, preço,
 * estoque, comanda aberta). O `id` é o `client_request_id` da RPC, então
 * reenviar a mesma ação nunca duplica o registro no banco.
 */

export type EstadoAcao = "pendente" | "sincronizando" | "sincronizado" | "erro" | "conflito";

export type EntradaPedidoOffline = {
  comandaId: string | null;
  clienteId: string | null;
  itens: ItemNovo[];
  desconto: number;
};

/** Só para mostrar na lista de pendências; nunca é enviado ao servidor. */
export type ResumoPedido = {
  destino: string;
  itens: { nome: string; quantidade: number }[];
  totalPrevisto: number;
};

export type AcaoOffline = {
  schemaVersion: number;
  id: string;
  usuarioId: string;
  empresaId: string;
  tipo: "criar_pedido";
  entrada: EntradaPedidoOffline;
  resumo: ResumoPedido;
  estado: EstadoAcao;
  tentativas: number;
  criadoEm: number;
  atualizadoEm: number;
  /** Mensagem para o usuário quando o servidor recusou. */
  erro: string | null;
  /** Id do registro criado no servidor. */
  resultadoId: string | null;
};

/** Falhas técnicas seguidas antes de parar de tentar sozinho. */
export const MAXIMO_TENTATIVAS = 5;
/** Ações sincronizadas ficam visíveis por este tempo e depois saem da lista. */
const VIDA_SINCRONIZADA_MS = 2 * 60 * 1000;

const prefixo = (usuarioId: string, empresaId: string) => `${usuarioId}:${empresaId}:`;
const chave = (acao: Pick<AcaoOffline, "usuarioId" | "empresaId" | "id">) =>
  `${prefixo(acao.usuarioId, acao.empresaId)}${acao.id}`;

export function salvarAcao(acao: AcaoOffline): Promise<void> {
  return gravar("fila", chave(acao), { ...acao, atualizadoEm: Date.now() });
}

export function removerAcao(acao: AcaoOffline): Promise<void> {
  return remover("fila", chave(acao));
}

export async function enfileirarPedido(dados: {
  id: string;
  usuarioId: string;
  empresaId: string;
  entrada: EntradaPedidoOffline;
  resumo: ResumoPedido;
}): Promise<void> {
  const agora = Date.now();
  await salvarAcao({
    schemaVersion: SCHEMA_VERSION,
    tipo: "criar_pedido",
    estado: "pendente",
    tentativas: 0,
    criadoEm: agora,
    atualizadoEm: agora,
    erro: null,
    resultadoId: null,
    ...dados,
  });
}

/** Ações do escopo, da mais antiga para a mais nova. Remove as já sincronizadas há algum tempo. */
export async function listarFila(usuarioId: string, empresaId: string): Promise<AcaoOffline[]> {
  const todas = await listarPorPrefixo<AcaoOffline>("fila", prefixo(usuarioId, empresaId));
  const agora = Date.now();
  const validas: AcaoOffline[] = [];

  for (const acao of todas) {
    const expirada =
      acao.estado === "sincronizado" && agora - acao.atualizadoEm > VIDA_SINCRONIZADA_MS;
    if (acao.schemaVersion !== SCHEMA_VERSION || expirada) {
      await removerAcao(acao);
    } else {
      validas.push(acao);
    }
  }

  return validas.sort((a, b) => a.criadoEm - b.criadoEm);
}

export type TipoFalha = "rede" | "sessao" | "regra" | "tecnica";

/** Decide o que fazer com um erro da sincronização. */
export function classificarFalha(erro: unknown): TipoFalha {
  const { code, message } = (typeof erro === "object" && erro !== null ? erro : {}) as {
    code?: unknown;
    message?: unknown;
  };
  const codigo = typeof code === "string" ? code : "";
  const mensagem = typeof message === "string" ? message : "";

  if (
    estadoConexao() === "OFFLINE" ||
    !navigator.onLine ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(mensagem)
  ) {
    return "rede";
  }
  if (codigo === "PGRST301" || codigo === "PGRST303" || /jwt/i.test(mensagem)) return "sessao";
  // Regra de negócio, permissão ou integridade: o servidor recusou de fato.
  if (codigo === "P0001" || codigo === "42501" || codigo.startsWith("23")) return "regra";
  return "tecnica";
}

export const ehFalhaDeRede = (erro: unknown) => classificarFalha(erro) === "rede";

/** Ações que a sincronização automática deve tentar. Conflito só volta por decisão do usuário. */
export const deveSincronizar = (acao: AcaoOffline) =>
  acao.estado === "pendente" ||
  acao.estado === "sincronizando" ||
  (acao.estado === "erro" && acao.tentativas < MAXIMO_TENTATIVAS);

export const estaPendente = (acao: AcaoOffline) => acao.estado !== "sincronizado";
