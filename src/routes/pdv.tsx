import { createFileRoute, redirect } from "@tanstack/react-router";

/** O PDV vive em /pedidos; este endereço continua aceito por compatibilidade. */
export const Route = createFileRoute("/pdv")({
  validateSearch: (search: Record<string, unknown>): { comanda?: string } => {
    const comanda = search["comanda"];
    return typeof comanda === "string" && comanda !== "" ? { comanda } : {};
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/pedidos", search, replace: true });
  },
});
