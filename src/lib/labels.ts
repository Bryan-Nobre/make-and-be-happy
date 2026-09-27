import type { Tone } from "@/components/shared/status-badge";
import type { OrderStatus, PaymentMethod, TableStatus } from "@/data/types";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  CONFIRMED: { label: "Confirmado", tone: "info" },
  PREPARING: { label: "Em preparo", tone: "warning" },
  READY: { label: "Pronto", tone: "success" },
  DELIVERED: { label: "Entregue", tone: "primary" },
  COMPLETED: { label: "Finalizado", tone: "neutral" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
};

export const TABLE_STATUS: Record<TableStatus, { label: string; tone: Tone }> = {
  LIVRE: { label: "Livre", tone: "success" },
  OCUPADA: { label: "Ocupada", tone: "primary" },
  AGUARDANDO_PAGAMENTO: { label: "Aguardando pagamento", tone: "warning" },
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Débito",
  CREDITO: "Crédito",
};
