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

export const MODULO_LABEL: Record<ModuloKey, string> = {
  dashboard: "Dashboard",
  pdv: "Pedidos e PDV",
  mesas: "Mesas",
  cozinha: "Cozinha",
  caixa: "Caixa",
  produtos: "Produtos",
  estoque: "Estoque",
  clientes: "Clientes",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
};

/** Módulos acessados a partir de Configurações. */
export const MODULOS_DE_GESTAO: readonly ModuloKey[] = [
  "configuracoes",
  "produtos",
  "estoque",
  "clientes",
  "relatorios",
];

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

/**
 * Pacote base do menu (self-service). Sempre aparece se o papel permitir.
 * Nota: só controla a navegação; a RLS continua autorizando o acesso real.
 */
export const MODULOS_MENU_BASE: readonly ModuloKey[] = [
  "dashboard",
  "pdv",
  "caixa",
  "estoque",
  "configuracoes",
];

/** Módulos que o restaurante pode ligar/desligar no menu. */
export const MODULOS_MENU_OPCIONAIS: readonly ModuloKey[] = [
  "mesas",
  "cozinha",
  "produtos",
  "clientes",
  "relatorios",
];

export function normalizarModulosExtras(extras: readonly string[] | null | undefined): ModuloKey[] {
  const permitidos = new Set<string>(MODULOS_MENU_OPCIONAIS);
  const vistos = new Set<ModuloKey>();
  const resultado: ModuloKey[] = [];
  for (const m of extras ?? []) {
    if (!permitidos.has(m) || vistos.has(m as ModuloKey)) continue;
    vistos.add(m as ModuloKey);
    resultado.push(m as ModuloKey);
  }
  return resultado;
}

/** O módulo aparece no menu? Base sempre; opcionais só se estiverem em `extras`. */
export function moduloNoMenu(modulo: ModuloKey, extras: readonly ModuloKey[]): boolean {
  if (MODULOS_MENU_BASE.includes(modulo)) return true;
  if (MODULOS_MENU_OPCIONAIS.includes(modulo)) return extras.includes(modulo);
  // Ajuda e afins sem chave de menu: sempre.
  return true;
}
