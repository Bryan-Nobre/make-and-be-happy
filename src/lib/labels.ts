import type { Tone } from "@/components/shared/status-badge";
import type { Database } from "@/types/db";

type Enums = Database["public"]["Enums"];

export const STATUS_PEDIDO: Record<
  Enums["status_operacional_pedido"],
  { label: string; tone: Tone }
> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  CONFIRMED: { label: "Na fila", tone: "info" },
  PREPARING: { label: "Em preparo", tone: "warning" },
  READY: { label: "Pronto", tone: "success" },
  DELIVERED: { label: "Entregue", tone: "primary" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
};

export const STATUS_FINANCEIRO: Record<
  Enums["status_financeiro_pedido"],
  { label: string; tone: Tone }
> = {
  UNPAID: { label: "A receber", tone: "neutral" },
  PARTIALLY_PAID: { label: "Pago em parte", tone: "warning" },
  PAID: { label: "Pago", tone: "success" },
  REFUNDED: { label: "Estornado", tone: "danger" },
};

export const STATUS_MESA: Record<Enums["status_mesa"], { label: string; tone: Tone }> = {
  LIVRE: { label: "Livre", tone: "success" },
  OCUPADA: { label: "Ocupada", tone: "primary" },
  AGUARDANDO_PAGAMENTO: { label: "Aguardando pagamento", tone: "warning" },
};

export const TIPO_MOVIMENTACAO: Record<
  Enums["tipo_movimentacao_caixa"],
  { label: string; saida: boolean }
> = {
  ABERTURA: { label: "Abertura", saida: false },
  VENDA: { label: "Venda", saida: false },
  SUPRIMENTO: { label: "Suprimento", saida: false },
  SANGRIA: { label: "Sangria", saida: true },
  ESTORNO: { label: "Estorno", saida: true },
};

export const STATUS_ESTOQUE: Record<Enums["status_estoque"], { label: string; tone: Tone }> = {
  NORMAL: { label: "Normal", tone: "success" },
  BAIXO: { label: "Baixo", tone: "warning" },
  SEM_ESTOQUE: { label: "Sem estoque", tone: "danger" },
};

export const TIPO_MOVIMENTACAO_ESTOQUE: Record<
  Enums["tipo_movimentacao_estoque"],
  { label: string; tone: Tone }
> = {
  ENTRADA: { label: "Entrada", tone: "success" },
  SAIDA: { label: "Saída", tone: "danger" },
  AJUSTE: { label: "Ajuste", tone: "info" },
};
