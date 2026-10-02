import type { MesaEstado, StatusMesa } from "@/services/pedidos";

/** Aparência da mesa física por estado: tampo, cadeiras ocupadas e indicador. */
export const VISUAL_MESA: Record<
  StatusMesa,
  { tampo: string; cadeira: string; ponto: string; texto: string }
> = {
  LIVRE: {
    tampo: "border-border bg-card",
    cadeira: "bg-primary/70",
    ponto: "border-[1.5px] border-primary bg-card",
    texto: "text-muted-foreground",
  },
  OCUPADA: {
    tampo: "border-primary/25 bg-primary-soft shadow-sm",
    cadeira: "bg-primary",
    ponto: "bg-primary",
    texto: "text-primary-strong",
  },
  AGUARDANDO_PAGAMENTO: {
    tampo: "border-warning/30 bg-warning-soft shadow-sm",
    cadeira: "bg-warning",
    ponto: "bg-warning",
    texto: "text-warning-foreground",
  },
};

export type Formato = "pequena" | "quadrada" | "retangular";

export const formatoDaMesa = (lugares: number): Formato =>
  lugares <= 2 ? "pequena" : lugares <= 4 ? "quadrada" : "retangular";

/** Distribui os lugares em volta do tampo; limitado para não poluir o mapa. */
export function distribuirCadeiras(lugares: number) {
  const n = Math.min(Math.max(lugares, 0), 12);
  if (n <= 2) return { topo: 0, direita: n >= 2 ? 1 : 0, base: 0, esquerda: n >= 1 ? 1 : 0 };
  if (n <= 4) return { topo: 1, direita: 1, base: n === 4 ? 1 : 0, esquerda: 1 };
  const meio = n - 2;
  return { topo: Math.ceil(meio / 2), direita: 1, base: Math.floor(meio / 2), esquerda: 1 };
}

/** Conta quitada, ainda aguardando a liberação da mesa. */
export const contaPaga = (m: MesaEstado) => m.total > 0 && m.valorPago >= m.total;

/** Aguardando pagamento mostra o que falta receber; ocupada mostra o consumo. */
export const valorDaMesa = (m: MesaEstado) =>
  m.status === "AGUARDANDO_PAGAMENTO" && !contaPaga(m)
    ? Math.max(0, m.total - m.valorPago)
    : m.total;

export const pessoasTexto = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

export const nomeComanda = (numero: number) => `Comanda #${String(numero).padStart(3, "0")}`;
