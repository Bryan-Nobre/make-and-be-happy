/**
 * Produtos mais lançados neste aparelho, por usuário e empresa. Serve só para
 * ordenar o atalho "Mais pedidos" do PDV: não é dado de negócio nem de venda
 * (o relatório oficial vem do banco e é restrito a dono e admin).
 */

type Contagem = Record<string, { n: number; ultimo: number }>;

const LIMITE_GUARDADOS = 200;
const LIMITE_ATALHO = 12;

const PREFIXO = "arvon:pdv:mais-pedidos:";
const chave = (usuarioId: string, empresaId: string) => `${PREFIXO}${usuarioId}:${empresaId}`;

/** Chamado no logout, junto com a limpeza dos dados offline. */
export function limparMaisPedidos(): void {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIXO)) localStorage.removeItem(k);
  }
}

function ler(usuarioId: string, empresaId: string): Contagem {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chave(usuarioId, empresaId)) ?? "{}");
    if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return {};
    const contagem: Contagem = {};
    for (const [id, v] of Object.entries(bruto)) {
      if (
        typeof v === "object" &&
        v !== null &&
        typeof (v as { n?: unknown }).n === "number" &&
        typeof (v as { ultimo?: unknown }).ultimo === "number"
      ) {
        contagem[id] = v as { n: number; ultimo: number };
      }
    }
    return contagem;
  } catch {
    return {};
  }
}

/** Ids dos produtos mais lançados, do mais para o menos frequente. */
export function lerMaisPedidos(usuarioId: string, empresaId: string): string[] {
  return Object.entries(ler(usuarioId, empresaId))
    .sort(([, a], [, b]) => b.n - a.n || b.ultimo - a.ultimo)
    .slice(0, LIMITE_ATALHO)
    .map(([id]) => id);
}

export function registrarMaisPedidos(
  usuarioId: string,
  empresaId: string,
  itens: { produtoId: string; quantidade: number }[],
): void {
  const contagem = ler(usuarioId, empresaId);
  const agora = Date.now();
  for (const { produtoId, quantidade } of itens) {
    const atual = contagem[produtoId] ?? { n: 0, ultimo: 0 };
    contagem[produtoId] = { n: atual.n + quantidade, ultimo: agora };
  }
  const mantidos = Object.entries(contagem)
    .sort(([, a], [, b]) => b.ultimo - a.ultimo)
    .slice(0, LIMITE_GUARDADOS);
  try {
    localStorage.setItem(chave(usuarioId, empresaId), JSON.stringify(Object.fromEntries(mantidos)));
  } catch {
    // Armazenamento cheio ou bloqueado: o atalho só deixa de aprender.
  }
}
