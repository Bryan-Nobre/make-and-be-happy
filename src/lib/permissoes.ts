import type { Database } from "@/types/db";

export type Papel = Database["public"]["Enums"]["papel_usuario"];

export type ModuloKey =
  | "dashboard"
  | "pdv"
  | "mesas"
  | "cozinha"
  | "caixa"
  | "produtos"
  | "estoque"
  | "clientes"
  | "relatorios"
  | "configuracoes";

export const PAPEIS: readonly Papel[] = ["owner", "admin", "cashier", "waiter", "kitchen"];

export const PAPEL_LABEL: Record<Papel, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  cashier: "Operador de caixa",
  waiter: "Garçom",
  kitchen: "Cozinha",
};

/**
 * Módulos que cada perfil enxerga na navegação (PRD 5).
 *
 * Nota: esta tabela controla apenas a interface. A autorização real é
 * garantida por RLS e pelas funções do Postgres, que revalidam o papel do
 * usuário em toda operação.
 */
export const MODULOS_POR_PAPEL: Record<Papel, readonly ModuloKey[]> = {
  owner: [
    "dashboard",
    "pdv",
    "mesas",
    "cozinha",
    "caixa",
    "produtos",
    "estoque",
    "clientes",
    "relatorios",
    "configuracoes",
  ],
  admin: [
    "dashboard",
    "pdv",
    "mesas",
    "cozinha",
    "caixa",
    "produtos",
    "estoque",
    "clientes",
    "relatorios",
    "configuracoes",
  ],
  cashier: ["dashboard", "pdv", "mesas", "cozinha", "caixa", "clientes"],
  waiter: ["pdv", "mesas", "cozinha"],
  kitchen: ["cozinha"],
};

export function podeVerModulo(papel: Papel | null, modulo: ModuloKey): boolean {
  return papel !== null && MODULOS_POR_PAPEL[papel].includes(modulo);
}
