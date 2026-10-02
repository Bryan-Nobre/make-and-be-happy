import type { Tone } from "@/components/shared/status-badge";
import type { PedidoDoDia, StatusFinanceiro, StatusPedido } from "@/services/pedidos";

/** Situação de produção, como o salão a enxerga. O KDS continua quem avança. */
export const STATUS_OPERACIONAL: Record<StatusPedido, { label: string; tone: Tone }> = {
  DRAFT: { label: "Em andamento", tone: "info" },
  CONFIRMED: { label: "Em andamento", tone: "info" },
  PREPARING: { label: "Em preparo", tone: "warning" },
  READY: { label: "Pronto", tone: "success" },
  DELIVERED: { label: "Entregue", tone: "primary" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
};

export const STATUS_PAGAMENTO: Record<StatusFinanceiro, { label: string; tone: Tone }> = {
  UNPAID: { label: "Não pago", tone: "neutral" },
  PARTIALLY_PAID: { label: "Parcial", tone: "warning" },
  PAID: { label: "Pago", tone: "success" },
  REFUNDED: { label: "Estornado", tone: "danger" },
};

export const emAndamento = (p: Pick<PedidoDoDia, "status">) =>
  p.status === "CONFIRMED" || p.status === "PREPARING" || p.status === "READY";

export const aguardandoPagamento = (p: Pick<PedidoDoDia, "status" | "statusFinanceiro">) =>
  p.status !== "CANCELLED" &&
  (p.statusFinanceiro === "UNPAID" || p.statusFinanceiro === "PARTIALLY_PAID");

export const finalizado = (p: Pick<PedidoDoDia, "status" | "statusFinanceiro">) =>
  p.status === "CANCELLED" || (p.status === "DELIVERED" && !aguardandoPagamento(p));

export const numeroPedido = (numero: number) => `#${String(numero).padStart(4, "0")}`;
