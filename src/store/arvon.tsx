import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addonGroups as seedAddonGroups,
  buildInitialCash,
  buildInitialOrders,
  buildStockMovements,
  buildTables,
  categories as seedCategories,
  company as seedCompany,
  customers as seedCustomers,
  products as seedProducts,
  stockItems as seedStockItems,
  users,
} from "@/data/mock";
import type {
  AddonGroup,
  CashMovement,
  CashMovementType,
  CashSession,
  Category,
  CompanySettings,
  Customer,
  ModuleKey,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
  RestaurantTable,
  Role,
  StockItem,
  StockMovement,
  StockStatus,
  User,
} from "@/data/types";
import { uid } from "@/lib/format";

/** Fixed clock reference so mock timestamps stay stable between renders. */
const BASE = Date.UTC(2026, 8, 25, 14, 30, 0);

export const PERMISSIONS: Record<Role, ModuleKey[]> = {
  OWNER: [
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
  ADMIN: [
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
  CASHIER: ["dashboard", "pdv", "mesas", "cozinha", "caixa", "clientes"],
  WAITER: ["pdv", "mesas", "cozinha"],
  KITCHEN: ["cozinha"],
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  CASHIER: "Operador de caixa",
  WAITER: "Garçom",
  KITCHEN: "Cozinha",
};

export const orderSubtotal = (order: Order) =>
  order.items.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        (item.unitPrice + item.addons.reduce((a, b) => a + b.price, 0)),
    0,
  );

export const orderTotal = (order: Order) =>
  Math.max(0, orderSubtotal(order) - order.discount + order.surcharge);

export const orderPaid = (order: Order) =>
  order.payments.reduce((sum, p) => sum + p.amount, 0);

export const stockStatus = (item: StockItem): StockStatus =>
  item.quantity === 0
    ? "SEM_ESTOQUE"
    : item.quantity <= item.minimum
      ? "BAIXO"
      : "NORMAL";

type NewOrderInput = {
  origin: "PDV" | "MESA";
  tableId?: string;
  tabNumber?: number;
  items: OrderItem[];
  discount: number;
  surcharge: number;
};

type State = {
  currentUser: User;
  company: CompanySettings;
  categories: Category[];
  addonGroups: AddonGroup[];
  products: Product[];
  tables: RestaurantTable[];
  orders: Order[];
  cash: CashSession;
  cashHistory: CashSession[];
  stock: StockItem[];
  stockMovements: StockMovement[];
  customers: Customer[];
};

type Store = State & {
  users: User[];
  can: (module: ModuleKey) => boolean;
  setCurrentUser: (id: string) => void;
  updateCompany: (patch: Partial<CompanySettings>) => void;
  // orders
  createOrder: (input: NewOrderInput) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string, reason: string) => void;
  payOrder: (id: string, payments: Omit<Payment, "id" | "at">[]) => void;
  // tables
  openTable: (tableId: string, people: number) => void;
  requestClose: (tableId: string) => void;
  releaseTable: (tableId: string) => void;
  transferTable: (fromId: string, toId: string) => void;
  // products
  saveProduct: (product: Product) => void;
  toggleProduct: (id: string) => void;
  duplicateProduct: (id: string) => void;
  saveCategory: (category: Category) => void;
  toggleCategory: (id: string) => void;
  saveAddonGroup: (group: AddonGroup) => void;
  // stock
  saveStockItem: (item: StockItem) => void;
  moveStock: (input: {
    itemId: string;
    type: StockMovement["type"];
    quantity: number;
    reason: string;
    note?: string;
  }) => { ok: boolean; error?: string };
  // cash
  openCash: (responsible: string, amount: number, note?: string) => void;
  addCashMovement: (
    type: CashMovementType,
    amount: number,
    description: string,
  ) => void;
  closeCash: (counted: number, reason?: string) => void;
  // customers
  saveCustomer: (customer: Customer) => void;
};

const ArvonContext = createContext<Store | null>(null);

export function ArvonProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({
    currentUser: users[0]!,
    company: seedCompany,
    categories: seedCategories,
    addonGroups: seedAddonGroups,
    products: seedProducts,
    tables: buildTables().map((t) =>
      t.id === "t3"
        ? {
            ...t,
            status: "OCUPADA",
            people: 4,
            tabNumber: 458,
            openedAt: new Date(BASE - 40 * 60000).toISOString(),
          }
        : t.id === "t7"
          ? {
              ...t,
              status: "OCUPADA",
              people: 2,
              tabNumber: 459,
              openedAt: new Date(BASE - 55 * 60000).toISOString(),
            }
          : t,
    ),
    orders: buildInitialOrders(BASE),
    cash: buildInitialCash(BASE),
    cashHistory: [],
    stock: seedStockItems,
    stockMovements: buildStockMovements(BASE),
    customers: seedCustomers,
  }));

  const patch = useCallback(
    (fn: (s: State) => State) => setState((s) => fn(s)),
    [],
  );

  const can = useCallback(
    (module: ModuleKey) =>
      PERMISSIONS[state.currentUser.role].includes(module),
    [state.currentUser.role],
  );

  const setCurrentUser = useCallback(
    (id: string) =>
      patch((s) => ({
        ...s,
        currentUser: users.find((u) => u.id === id) ?? s.currentUser,
      })),
    [patch],
  );

  const updateCompany = useCallback(
    (p: Partial<CompanySettings>) =>
      patch((s) => ({ ...s, company: { ...s.company, ...p } })),
    [patch],
  );

  const createOrder = useCallback(
    (input: NewOrderInput) => {
      const order: Order = {
        id: uid("ord"),
        number: 0,
        origin: input.origin,
        tableId: input.tableId,
        tabNumber: input.tabNumber,
        status: "CONFIRMED",
        items: input.items,
        discount: input.discount,
        surcharge: input.surcharge,
        payments: [],
        createdAt: new Date().toISOString(),
      };
      patch((s) => {
        const next = Math.max(900, ...s.orders.map((o) => o.number)) + 1;
        order.number = next;
        return { ...s, orders: [{ ...order }, ...s.orders] };
      });
      return order;
    },
    [patch],
  );

  const setOrderStatus = useCallback(
    (id: string, status: OrderStatus) =>
      patch((s) => ({
        ...s,
        orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
      })),
    [patch],
  );

  const cancelOrder = useCallback(
    (id: string, reason: string) =>
      patch((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === id ? { ...o, status: "CANCELLED", cancelReason: reason } : o,
        ),
      })),
    [patch],
  );

  const payOrder = useCallback(
    (id: string, payments: Omit<Payment, "id" | "at">[]) =>
      patch((s) => {
        const order = s.orders.find((o) => o.id === id);
        if (!order) return s;
        const at = new Date().toISOString();
        const full: Payment[] = payments.map((p) => ({
          ...p,
          id: uid("pay"),
          at,
        }));
        const movements: CashMovement[] = full.map((p) => ({
          id: uid("cm"),
          type: "SALE",
          amount: p.amount,
          method: p.method,
          description: `Pedido #${order.number}`,
          orderNumber: order.number,
          at,
        }));
        return {
          ...s,
          orders: s.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  payments: [...o.payments, ...full],
                  status: "COMPLETED",
                }
              : o,
          ),
          cash:
            s.cash.status === "OPEN"
              ? { ...s.cash, movements: [...s.cash.movements, ...movements] }
              : s.cash,
        };
      }),
    [patch],
  );

  const openTable = useCallback(
    (tableId: string, people: number) =>
      patch((s) => {
        const tabNumber =
          Math.max(
            457,
            ...s.tables.map((t) => t.tabNumber ?? 0),
            ...s.orders.map((o) => o.tabNumber ?? 0),
          ) + 1;
        return {
          ...s,
          tables: s.tables.map((t) =>
            t.id === tableId
              ? {
                  ...t,
                  status: "OCUPADA",
                  people,
                  tabNumber,
                  openedAt: new Date().toISOString(),
                }
              : t,
          ),
        };
      }),
    [patch],
  );

  const requestClose = useCallback(
    (tableId: string) =>
      patch((s) => ({
        ...s,
        tables: s.tables.map((t) =>
          t.id === tableId ? { ...t, status: "AGUARDANDO_PAGAMENTO" } : t,
        ),
      })),
    [patch],
  );

  const releaseTable = useCallback(
    (tableId: string) =>
      patch((s) => ({
        ...s,
        tables: s.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: "LIVRE",
                people: undefined,
                tabNumber: undefined,
                openedAt: undefined,
              }
            : t,
        ),
      })),
    [patch],
  );

  const transferTable = useCallback(
    (fromId: string, toId: string) =>
      patch((s) => {
        const from = s.tables.find((t) => t.id === fromId);
        if (!from) return s;
        return {
          ...s,
          tables: s.tables.map((t) => {
            if (t.id === fromId)
              return {
                ...t,
                status: "LIVRE",
                people: undefined,
                tabNumber: undefined,
                openedAt: undefined,
              };
            if (t.id === toId)
              return {
                ...t,
                status: from.status,
                people: from.people,
                tabNumber: from.tabNumber,
                openedAt: from.openedAt,
              };
            return t;
          }),
          orders: s.orders.map((o) =>
            o.tableId === fromId ? { ...o, tableId: toId } : o,
          ),
        };
      }),
    [patch],
  );

  const saveProduct = useCallback(
    (product: Product) =>
      patch((s) => ({
        ...s,
        products: s.products.some((p) => p.id === product.id)
          ? s.products.map((p) => (p.id === product.id ? product : p))
          : [...s.products, product],
      })),
    [patch],
  );

  const toggleProduct = useCallback(
    (id: string) =>
      patch((s) => ({
        ...s,
        products: s.products.map((p) =>
          p.id === id ? { ...p, active: !p.active } : p,
        ),
      })),
    [patch],
  );

  const duplicateProduct = useCallback(
    (id: string) =>
      patch((s) => {
        const base = s.products.find((p) => p.id === id);
        if (!base) return s;
        return {
          ...s,
          products: [
            ...s.products,
            {
              ...base,
              id: uid("p"),
              name: `${base.name} (cópia)`,
              code: `${base.code}-C`,
              active: false,
            },
          ],
        };
      }),
    [patch],
  );

  const saveCategory = useCallback(
    (category: Category) =>
      patch((s) => ({
        ...s,
        categories: s.categories.some((c) => c.id === category.id)
          ? s.categories.map((c) => (c.id === category.id ? category : c))
          : [...s.categories, category],
      })),
    [patch],
  );

  const toggleCategory = useCallback(
    (id: string) =>
      patch((s) => ({
        ...s,
        categories: s.categories.map((c) =>
          c.id === id ? { ...c, active: !c.active } : c,
        ),
      })),
    [patch],
  );

  const saveAddonGroup = useCallback(
    (group: AddonGroup) =>
      patch((s) => ({
        ...s,
        addonGroups: s.addonGroups.some((g) => g.id === group.id)
          ? s.addonGroups.map((g) => (g.id === group.id ? group : g))
          : [...s.addonGroups, group],
      })),
    [patch],
  );

  const saveStockItem = useCallback(
    (item: StockItem) =>
      patch((s) => ({
        ...s,
        stock: s.stock.some((i) => i.id === item.id)
          ? s.stock.map((i) => (i.id === item.id ? item : i))
          : [...s.stock, item],
      })),
    [patch],
  );

  const moveStock = useCallback<Store["moveStock"]>(
    ({ itemId, type, quantity, reason, note }) => {
      const item = state.stock.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: "Item não encontrado." };
      const delta =
        type === "ENTRADA"
          ? quantity
          : type === "SAIDA"
            ? -quantity
            : quantity - item.quantity;
      if (item.quantity + delta < 0)
        return {
          ok: false,
          error: "A saída é maior que o saldo disponível. O estoque não pode ficar negativo.",
        };
      patch((s) => ({
        ...s,
        stock: s.stock.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i,
        ),
        stockMovements: [
          {
            id: uid("sm"),
            itemId,
            itemName: item.name,
            type,
            quantity: type === "AJUSTE" ? delta : quantity,
            reason,
            note,
            at: new Date().toISOString(),
            user: s.currentUser.name,
          },
          ...s.stockMovements,
        ],
      }));
      return { ok: true };
    },
    [patch, state.stock],
  );

  const openCash = useCallback(
    (responsible: string, amount: number, note?: string) =>
      patch((s) => ({
        ...s,
        cash: {
          id: uid("cash"),
          status: "OPEN",
          responsible,
          openingAmount: amount,
          openedAt: new Date().toISOString(),
          note,
          movements: [
            {
              id: uid("cm"),
              type: "OPENING",
              amount,
              description: "Abertura de caixa",
              at: new Date().toISOString(),
            },
          ],
        },
      })),
    [patch],
  );

  const addCashMovement = useCallback(
    (type: CashMovementType, amount: number, description: string) =>
      patch((s) => ({
        ...s,
        cash: {
          ...s.cash,
          movements: [
            ...s.cash.movements,
            {
              id: uid("cm"),
              type,
              amount,
              description,
              at: new Date().toISOString(),
            },
          ],
        },
      })),
    [patch],
  );

  const closeCash = useCallback(
    (counted: number, reason?: string) =>
      patch((s) => {
        const expected = expectedCash(s.cash);
        const closed: CashSession = {
          ...s.cash,
          status: "CLOSED",
          closedAt: new Date().toISOString(),
          countedAmount: counted,
          difference: counted - expected,
          differenceReason: reason,
        };
        return { ...s, cash: closed, cashHistory: [closed, ...s.cashHistory] };
      }),
    [patch],
  );

  const saveCustomer = useCallback(
    (customer: Customer) =>
      patch((s) => ({
        ...s,
        customers: s.customers.some((c) => c.id === customer.id)
          ? s.customers.map((c) => (c.id === customer.id ? customer : c))
          : [...s.customers, customer],
      })),
    [patch],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      users,
      can,
      setCurrentUser,
      updateCompany,
      createOrder,
      setOrderStatus,
      cancelOrder,
      payOrder,
      openTable,
      requestClose,
      releaseTable,
      transferTable,
      saveProduct,
      toggleProduct,
      duplicateProduct,
      saveCategory,
      toggleCategory,
      saveAddonGroup,
      saveStockItem,
      moveStock,
      openCash,
      addCashMovement,
      closeCash,
      saveCustomer,
    }),
    [
      state,
      can,
      setCurrentUser,
      updateCompany,
      createOrder,
      setOrderStatus,
      cancelOrder,
      payOrder,
      openTable,
      requestClose,
      releaseTable,
      transferTable,
      saveProduct,
      toggleProduct,
      duplicateProduct,
      saveCategory,
      toggleCategory,
      saveAddonGroup,
      saveStockItem,
      moveStock,
      openCash,
      addCashMovement,
      closeCash,
      saveCustomer,
    ],
  );

  return <ArvonContext value={value}>{children}</ArvonContext>;
}

export function useArvon() {
  const ctx = useContext(ArvonContext);
  if (!ctx) throw new Error("useArvon deve ser usado dentro de ArvonProvider");
  return ctx;
}

export function expectedCash(session: CashSession) {
  return session.movements.reduce((sum, m) => {
    if (m.type === "OPENING" || m.type === "SUPPLY") return sum + m.amount;
    if (m.type === "WITHDRAWAL" || m.type === "REFUND") return sum - m.amount;
    if (m.type === "SALE" && m.method === "DINHEIRO") return sum + m.amount;
    if (m.type === "ADJUSTMENT") return sum + m.amount;
    return sum;
  }, 0);
}

export function salesByMethod(session: CashSession) {
  const result: Record<PaymentMethod, number> = {
    DINHEIRO: 0,
    PIX: 0,
    DEBITO: 0,
    CREDITO: 0,
  };
  session.movements
    .filter((m) => m.type === "SALE" && m.method)
    .forEach((m) => {
      result[m.method as PaymentMethod] += m.amount;
    });
  return result;
}
