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
  /**
   * Abertura de mesa feita offline da qual o pedido depende (id da ação). A
   * comanda só ganha id no servidor; no envio ele substitui esta referência.
   */
  comandaLocal?: string | null;
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

export type EntradaAberturaOffline = { mesaId: string; pessoas: number };
export type ResumoAbertura = { mesa: string; pessoas: number };

export type EntradaPedirContaOffline = {
  comandaId: string | null;
  /** Abertura de mesa feita offline da qual o pedido de conta depende. */
  comandaLocal?: string | null;
};
export type ResumoPedirConta = { mesa: string };

type Base = {
  schemaVersion: number;
  id: string;
  usuarioId: string;
  empresaId: string;
  estado: EstadoAcao;
  tentativas: number;
  criadoEm: number;
  atualizadoEm: number;
  /** Mensagem para o usuário quando o servidor recusou. */
  erro: string | null;
  /** Id do registro criado no servidor. */
  resultadoId: string | null;
};

export type AcaoPedido = Base & {
  tipo: "criar_pedido";
  entrada: EntradaPedidoOffline;
  resumo: ResumoPedido;
};

export type AcaoAbertura = Base & {
  tipo: "abrir_comanda";
  entrada: EntradaAberturaOffline;
  resumo: ResumoAbertura;
};

/**
 * `pedir_conta` não tem `client_request_id` no servidor: reenviar depois de um
 * sucesso é recusado com "comanda não está aberta". A sincronização confere o
 * estado da comanda antes de tratar isso como conflito.
 */
export type AcaoPedirConta = Base & {
  tipo: "pedir_conta";
  entrada: EntradaPedirContaOffline;
  resumo: ResumoPedirConta;
};

export type AcaoOffline = AcaoPedido | AcaoAbertura | AcaoPedirConta;
/** Ações que apontam para uma comanda e podem depender de uma abertura offline. */
export type AcaoNaComanda = AcaoPedido | AcaoPedirConta;

/** Comanda aberta offline ainda sem id no servidor. */
const PREFIXO_LOCAL = "local:";
export const idComandaLocal = (aberturaId: string) => `${PREFIXO_LOCAL}${aberturaId}`;
export const ehComandaLocal = (comandaId: string | null | undefined): comandaId is string =>
  typeof comandaId === "string" && comandaId.startsWith(PREFIXO_LOCAL);
export const aberturaDaComandaLocal = (comandaId: string) => comandaId.slice(PREFIXO_LOCAL.length);

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

const novaBase = (dados: { id: string; usuarioId: string; empresaId: string }): Base => {
  const agora = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    estado: "pendente",
    tentativas: 0,
    criadoEm: agora,
    atualizadoEm: agora,
    erro: null,
    resultadoId: null,
    ...dados,
  };
};

type Escopo = { id: string; usuarioId: string; empresaId: string };

export function enfileirarPedido(
  dados: Escopo & { entrada: EntradaPedidoOffline; resumo: ResumoPedido },
): Promise<void> {
  const { entrada, resumo, ...escopo } = dados;
  return salvarAcao({ ...novaBase(escopo), tipo: "criar_pedido", entrada, resumo });
}

export function enfileirarAbertura(
  dados: Escopo & { entrada: EntradaAberturaOffline; resumo: ResumoAbertura },
): Promise<void> {
  const { entrada, resumo, ...escopo } = dados;
  return salvarAcao({ ...novaBase(escopo), tipo: "abrir_comanda", entrada, resumo });
}

export function enfileirarPedirConta(
  dados: Escopo & { entrada: EntradaPedirContaOffline; resumo: ResumoPedirConta },
): Promise<void> {
  const { entrada, resumo, ...escopo } = dados;
  return salvarAcao({ ...novaBase(escopo), tipo: "pedir_conta", entrada, resumo });
}

const naComanda = (a: AcaoOffline): a is AcaoNaComanda =>
  a.tipo === "criar_pedido" || a.tipo === "pedir_conta";

/** Ações que esperam a abertura de mesa informada. */
export const dependentesDe = (acoes: AcaoOffline[], aberturaId: string) =>
  acoes.filter((a): a is AcaoNaComanda => naComanda(a) && a.entrada.comandaLocal === aberturaId);

/** Aponta a ação para a comanda real, criada quando a abertura foi aceita. */
export const ligarAComanda = <T extends AcaoNaComanda>(acao: T, comandaId: string): T => ({
  ...acao,
  entrada: { ...acao.entrada, comandaId, comandaLocal: null },
});

/**
 * Pedido de conta ainda não aceito pelo servidor para a comanda (id real ou
 * `local:`). Conflitos ficam de fora: a comanda segue aberta no servidor.
 */
export const contaPendenteDe = (acoes: AcaoOffline[], comandaId: string | null) =>
  comandaId === null
    ? undefined
    : acoes.find(
        (a): a is AcaoPedirConta =>
          a.tipo === "pedir_conta" &&
          a.estado !== "sincronizado" &&
          a.estado !== "conflito" &&
          (ehComandaLocal(comandaId)
            ? a.entrada.comandaLocal === aberturaDaComandaLocal(comandaId)
            : a.entrada.comandaId === comandaId),
      );

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
